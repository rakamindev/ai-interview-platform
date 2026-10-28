# frozen_string_literal: true

module FitGap
  # N13: Generates a fit/gap report comparing a portfolio against a vacancy.
  # Uses rule-based comparison for skill levels + Gemini Flash for culture narrative.
  class Engine
    def initialize(portfolio:, vacancy:, gemini_client: nil)
      @portfolio = portfolio
      @vacancy   = vacancy
      @gemini_client = gemini_client || Gemini::HttpClient.new(
        model:   ENV.fetch('GEMINI_FLASH_MODEL', 'gemini-2.0-flash-001'),
        timeout: 30
      )
    end

    # Returns the FitGapReport record.
    def call
      skill_comparisons = build_skill_comparisons
      narratives        = generate_narratives(skill_comparisons)

      report = save_report(
        skill_comparisons: skill_comparisons,
        culture_narrative: narratives[:culture],
        overall_narrative: narratives[:overall],
        generated_at:      Time.current
      )

      Rails.logger.info("[N13] Fit/gap report generated: portfolio=#{@portfolio.id} vacancy=#{@vacancy.id}")
      report
    end

    private

    # Two jobs for the same (portfolio, vacancy) can race past find_or_initialize;
    # the unique index makes the loser fail, so it retries as an update.
    def save_report(attributes)
      attempts = 0
      begin
        report = FitGapReport.find_or_initialize_by(portfolio_id: @portfolio.id, vacancy_id: @vacancy.id)
        report.update!(attributes)
        report
      rescue ActiveRecord::RecordNotUnique
        attempts += 1
        retry if attempts < 2
        raise
      end
    end

    # One row per vacancy skill. Shape (stored in fit_gap_reports.skill_comparisons):
    #   required_level   - level the vacancy asks for (expected_level kept for old readers)
    #   candidate_level  - effective level (assessor override wins), nil if not assessed
    #   result           - match | gap | exceed | not_assessed
    #   not_assessed_reason - never_reached | model_omitted | invalid_level | not_in_interview
    #   needs_review     - true when a person should look before relying on the row
    def build_skill_comparisons
      portfolio_skills = effective_portfolio_skills

      @vacancy.vacancy_skills.order(:id).map do |vacancy_skill|
        skill    = find_portfolio_skill(portfolio_skills, vacancy_skill.skill_label, vacancy_skill.skill_id)
        required = vacancy_skill.expected_level
        level    = skill&.dig(:effective_level)

        row = {
          skill_label:     vacancy_skill.skill_label,
          skill_id:        vacancy_skill.skill_id,
          required_level:  required,
          expected_level:  required,
          candidate_level: level,
          confidence:      skill&.dig(:confidence),
          is_override:     skill&.dig(:overridden) || false
        }

        if level.nil?
          row.merge(result: 'not_assessed', delta: nil, needs_review: true,
                    not_assessed_reason: skill&.dig(:status_reason) || 'not_in_interview')
        else
          delta = level - required
          row.merge(result: delta.zero? ? 'match' : (delta.positive? ? 'exceed' : 'gap'), delta:,
                    needs_review: !row[:is_override] && row[:confidence] == 'low',
                    not_assessed_reason: nil)
        end
      end
    end

    # Returns portfolio skills with overrides applied.
    def effective_portfolio_skills
      @portfolio.portfolio_skills.includes(:assessor_override).map do |skill|
        {
          id:              skill.id,
          skill_id:        skill.skill_id,
          skill_label:     skill.skill_label,
          ai_level:        skill.ai_level,
          effective_level: skill.effective_level,
          confidence:      skill.ai_confidence,
          status_reason:   skill.status_reason,
          overridden:      skill.assessor_override.present?
        }
      end
    end

    def find_portfolio_skill(portfolio_skills, label, skill_id)
      (skill_id.present? && portfolio_skills.find { |s| s[:skill_id] == skill_id }) ||
        portfolio_skills.find { |s| s[:skill_label].to_s.casecmp?(label.to_s.strip) }
    end

    def generate_narratives(skill_comparisons)
      gaps    = skill_comparisons.select { |c| c[:result] == 'gap' }
      matches = skill_comparisons.select { |c| c[:result] == 'match' }
      exceeds = skill_comparisons.select { |c| c[:result] == 'exceed' }
      not_assessed = skill_comparisons.select { |c| c[:result] == 'not_assessed' }

      prompt = build_narrative_prompt(gaps, matches, exceeds, not_assessed)

      begin
        response = @gemini_client.generate_content(prompt, temperature: 0.4)
        data = response.is_a?(Hash) ? response : JSON.parse(response)
        { culture:  data['culture_narrative'].to_s.strip.presence,
          overall:  data['overall_narrative'].to_s.strip.presence || generate_fallback_narrative(skill_comparisons) }
      rescue => e
        Rails.logger.error("[N13] Narrative generation failed for portfolio=#{@portfolio.id}: #{e.class}")
        { culture: nil, overall: generate_fallback_narrative(skill_comparisons) }
      end
    end

    def build_narrative_prompt(gaps, matches, exceeds, not_assessed)
      vacancy = @vacancy
      portfolio_session = @portfolio.session
      assessment = portfolio_session.assessment

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

        RULES:
        - "Not assessed" means the interview produced no evidence. It is NOT a weakness
          and must not be described as a gap. Say it still needs to be assessed.
        - Do not recommend hiring or rejecting. A person makes that decision; you summarize
          the evidence and say what to probe next.

        Write two short narrative paragraphs:
        1. culture_narrative: 2-3 sentences on culture/competency fit based on the comparison patterns.
        2. overall_narrative: 2-3 sentences summarizing strengths, gaps, and what still needs to be assessed.

        OUTPUT (JSON only):
        {
          "culture_narrative": "...",
          "overall_narrative": "..."
        }
      PROMPT
    end

    def generate_fallback_narrative(comparisons)
      counts = comparisons.group_by { |c| c[:result] }.transform_values(&:count)
      text = "Against role requirements: #{counts.fetch('match', 0)} match, " \
             "#{counts.fetch('exceed', 0)} exceed, #{counts.fetch('gap', 0)} below the required level."
      not_assessed = counts.fetch('not_assessed', 0)
      text += " #{not_assessed} not yet assessed and need a follow-up before a decision." if not_assessed.positive?
      text
    end
  end
end
