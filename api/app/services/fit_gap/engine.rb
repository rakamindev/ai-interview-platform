# frozen_string_literal: true

require 'digest'

module FitGap
  # N13: Generates a fit/gap report comparing a portfolio against a vacancy.
  # Uses rule-based comparison for skill levels + Gemini Flash for culture narrative.
  #
  # A skill without a level (never reached, or no usable evidence) is
  # 'not_assessed'. It is unknown, not weak, and is never counted as a gap.
  class Engine
    class InvalidResponseError < StandardError; end

    def initialize(portfolio:, vacancy:, gemini_client: nil)
      @portfolio = portfolio
      @vacancy   = vacancy
      @gemini_client = gemini_client
    end

    # Digest of everything a report is computed from. When it no longer matches
    # the stored one (override saved, vacancy edited, portfolio regenerated),
    # the report is stale.
    def self.fingerprint(portfolio, vacancy)
      skills = portfolio.portfolio_skills.includes(:assessor_override).map do |s|
        [s.identity_key, s.rating_status, s.ai_level, s.effective_level, s.ai_confidence]
      end
      requirements = vacancy.vacancy_skills.map { |v| [v.skill_id, v.skill_label, v.expected_level] }

      Digest::SHA256.hexdigest(
        [
          portfolio.generated_at&.iso8601(6),
          skills.sort_by(&:to_s),
          requirements.sort_by(&:to_s),
          vacancy.culture_dimensions,
          vacancy.competency_expectations
        ].to_json
      )
    end

    # Returns the FitGapReport record.
    def call
      skill_comparisons = build_skill_comparisons
      narratives        = generate_narratives(skill_comparisons)

      attributes = {
        skill_comparisons: skill_comparisons,
        culture_narrative: narratives[:culture],
        overall_narrative: narratives[:overall],
        input_fingerprint: self.class.fingerprint(@portfolio, @vacancy),
        generated_at:      Time.current
      }

      report = save_report(attributes)
      Rails.logger.info("[N13] Fit/gap report generated: portfolio=#{@portfolio.id} vacancy=#{@vacancy.id}")
      report
    end

    private

    def gemini_client
      @gemini_client ||= Gemini::HttpClient.new(
        model:   ENV.fetch('GEMINI_FLASH_MODEL', 'gemini-2.0-flash-001'),
        timeout: 30
      )
    end

    # Two jobs for the same pair can race to insert; the unique index on
    # (portfolio_id, vacancy_id) makes the loser update the winner's row.
    def save_report(attributes)
      # requires_new: a savepoint, so a unique violation doesn't poison an
      # enclosing transaction and the rescue below can still query.
      FitGapReport.transaction(requires_new: true) do
        report = FitGapReport.find_or_initialize_by(portfolio_id: @portfolio.id, vacancy_id: @vacancy.id)
        report.update!(attributes)
        report
      end
    rescue ActiveRecord::RecordNotUnique
      report = FitGapReport.find_by!(portfolio_id: @portfolio.id, vacancy_id: @vacancy.id)
      report.update!(attributes)
      report
    end

    def build_skill_comparisons
      portfolio_skills = @portfolio.portfolio_skills.includes(:assessor_override).to_a

      @vacancy.vacancy_skills.order(:id).map do |requirement|
        skill    = find_portfolio_skill(portfolio_skills, requirement)
        override = skill&.assessor_override
        level    = skill&.effective_level
        expected = requirement.expected_level

        if level
          delta  = level - expected
          result = if delta.zero? then 'match' elsif delta.positive? then 'exceed' else 'gap' end
        else
          delta  = nil
          result = 'not_assessed'
        end

        {
          skill_label:     requirement.skill_label,
          skill_id:        requirement.skill_id,
          expected_level:  expected,
          candidate_level: level,
          ai_level:        skill&.ai_level,
          result:          result,
          delta:           delta,
          confidence:      skill&.rated? ? skill.ai_confidence : nil,
          rating_status:   skill ? skill.rating_status : 'missing',
          overridden:      override.present?,
          # An assessor has already looked at overridden skills.
          low_confidence:  level.present? && override.nil? && skill.ai_confidence == 'low'
        }
      end
    end

    def find_portfolio_skill(portfolio_skills, requirement)
      (requirement.skill_id.present? && portfolio_skills.find { |s| s.skill_id == requirement.skill_id }) ||
        portfolio_skills.find do |s|
          PortfolioSkill.normalize_label(s.skill_label) == PortfolioSkill.normalize_label(requirement.skill_label)
        end
    end

    def generate_narratives(skill_comparisons)
      by_result = skill_comparisons.group_by { |c| c[:result] }
      prompt = build_narrative_prompt(
        by_result.fetch('gap', []), by_result.fetch('match', []),
        by_result.fetch('exceed', []), by_result.fetch('not_assessed', [])
      )

      data = gemini_client.generate_content(prompt, temperature: 0.4)
      unless data.is_a?(Hash) && data['culture_narrative'].is_a?(String) && data['overall_narrative'].is_a?(String)
        raise InvalidResponseError, 'Narrative response was not the expected JSON'
      end

      { culture: data['culture_narrative'].truncate(3000), overall: data['overall_narrative'].truncate(3000) }
    rescue StandardError => e
      Rails.logger.error("[N13] Narrative generation failed: #{e.class}")
      { culture: nil, overall: generate_fallback_narrative(skill_comparisons) }
    end

    def build_narrative_prompt(gaps, matches, exceeds, not_assessed)
      vacancy = @vacancy
      low_confidence = (gaps + matches + exceeds).select { |c| c[:low_confidence] }

      <<~PROMPT
        You are writing a fit/gap analysis narrative for a candidate evaluation.

        ROLE: #{vacancy.role_title}
        #{vacancy.culture_dimensions.present? ? "CULTURE EXPECTATIONS:\n#{vacancy.culture_dimensions}\n" : ""}
        #{vacancy.competency_expectations.present? ? "COMPETENCY EXPECTATIONS:\n#{vacancy.competency_expectations}\n" : ""}

        SKILL COMPARISON RESULTS:
        - Matches (#{matches.count}): #{matches.map { |c| "#{c[:skill_label]} (L#{c[:candidate_level]})" }.join(', ')}
        - Gaps (#{gaps.count}): #{gaps.map { |c| "#{c[:skill_label]}: candidate L#{c[:candidate_level]} vs expected L#{c[:expected_level]} (delta #{c[:delta]})" }.join(', ')}
        - Exceeds (#{exceeds.count}): #{exceeds.map { |c| "#{c[:skill_label]}: candidate L#{c[:candidate_level]} vs expected L#{c[:expected_level]} (+#{c[:delta]})" }.join(', ')}
        - Not assessed (#{not_assessed.count}): #{not_assessed.map { |c| c[:skill_label] }.join(', ')}
        - Low-confidence ratings (#{low_confidence.count}): #{low_confidence.map { |c| c[:skill_label] }.join(', ')}

        RULES:
        - "Not assessed" means the interview produced no evidence either way. It is NOT a weakness.
          Never describe it as a gap or use it as a reason against the candidate. Recommend assessing it instead.
        - Treat low-confidence ratings as provisional and say they need verification.

        Write two short narrative paragraphs:
        1. culture_narrative: 2-3 sentences on culture/competency fit based on the comparison patterns.
        2. overall_narrative: 2-3 sentence overall hiring recommendation summary.

        OUTPUT (JSON only):
        {
          "culture_narrative": "...",
          "overall_narrative": "..."
        }
      PROMPT
    end

    def generate_fallback_narrative(comparisons)
      counts = comparisons.group_by { |c| c[:result] }.transform_values(&:count)
      text = "Automatic summary (the AI narrative was unavailable): " \
             "#{pluralize(counts.fetch('match', 0), 'skill match', 'skill matches')}, " \
             "#{pluralize(counts.fetch('exceed', 0), 'exceed')} and " \
             "#{pluralize(counts.fetch('gap', 0), 'gap')} against role requirements."
      not_assessed = counts.fetch('not_assessed', 0)
      if not_assessed.positive?
        text += " #{pluralize(not_assessed, 'required skill was', 'required skills were')} " \
                'not assessed in this interview and not counted.'
      end
      text
    end

    def pluralize(count, singular, plural = "#{singular}s")
      "#{count} #{count == 1 ? singular : plural}"
    end
  end
end
