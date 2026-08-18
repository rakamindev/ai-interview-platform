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

      report = FitGapReport.find_or_initialize_by(
        portfolio_id: @portfolio.id,
        vacancy_id:   @vacancy.id
      )

      report.update!(
        skill_comparisons: skill_comparisons,
        culture_narrative: narratives[:culture],
        overall_narrative: narratives[:overall],
        narrative_status:  narratives[:status],
        generated_at:      Time.current
      )

      Rails.logger.info(
        "[N13] Fit/gap report generated: portfolio=#{@portfolio.id} vacancy=#{@vacancy.id} " \
        "narrative=#{narratives[:status]}"
      )
      report
    end

    private

    def build_skill_comparisons
      portfolio_skills = effective_portfolio_skills

      # Iterated directly rather than through index_by(&:skill_label): two
      # vacancy skills may share a label (nothing in the schema forbids it),
      # and index_by silently keeps only the last, dropping a requirement
      # from the report entirely.
      @vacancy.vacancy_skills.map do |vacancy_skill|
        portfolio_skill = find_portfolio_skill(
          portfolio_skills, vacancy_skill.skill_label, vacancy_skill.skill_id
        )

        expected_level  = vacancy_skill.expected_level
        candidate_level = portfolio_skill&.dig(:effective_level)

        # Three distinct states, and they must not collapse into each other:
        #   - no portfolio skill at all  → the interview never covered it
        #   - present but unrated        → covered, evidence was insufficient
        #   - present and rated          → compare
        if portfolio_skill.nil?
          result = 'not_assessed'
          delta  = nil
        elsif candidate_level.nil?
          result = 'not_assessed'
          delta  = nil
        else
          delta  = candidate_level - expected_level
          result = delta.zero? ? 'match' : (delta.positive? ? 'exceed' : 'gap')
        end

        {
          skill_label:     vacancy_skill.skill_label,
          skill_id:        vacancy_skill.skill_id,
          candidate_level: candidate_level,
          expected_level:  expected_level,
          result:          result,
          delta:           delta,
          confidence:      portfolio_skill&.dig(:confidence),
          # Provenance. Previously computed in effective_portfolio_skills and
          # then dropped on the floor, so the UI could never distinguish a
          # model rating from a human one — while still printing a legend
          # claiming it could.
          is_override:     portfolio_skill ? portfolio_skill[:overridden] : false,
          ai_level:        portfolio_skill&.dig(:ai_level),
          # Distinguishes "we never asked" from "we asked and could not tell".
          not_assessed_reason: not_assessed_reason(portfolio_skill, candidate_level)
        }
      end
    end

    def not_assessed_reason(portfolio_skill, candidate_level)
      return nil unless candidate_level.nil?

      portfolio_skill.nil? ? 'not_covered' : 'insufficient_evidence'
    end

    # Returns portfolio skills with overrides applied.
    def effective_portfolio_skills
      @portfolio.portfolio_skills.includes(:assessor_override).map do |skill|
        override = skill.assessor_override
        {
          id:              skill.id,
          skill_id:        skill.skill_id,
          skill_label:     skill.skill_label,
          ai_level:        skill.ai_level,
          effective_level: override ? override.override_level : skill.ai_level,
          confidence:      skill.ai_confidence,
          overridden:      override.present?
        }
      end
    end

    def find_portfolio_skill(portfolio_skills, label, skill_id)
      if skill_id.present?
        by_id = portfolio_skills.find { |s| s[:skill_id].present? && s[:skill_id].casecmp?(skill_id) }
        return by_id if by_id
      end

      # Labels arrive from free-text vacancy and assessment forms, so they
      # differ by casing and trailing whitespace far more often than not.
      target = normalise(label)
      portfolio_skills.find { |s| normalise(s[:skill_label]) == target }
    end

    def normalise(value) = value.to_s.strip.downcase.gsub(/\s+/, ' ')

    def generate_narratives(skill_comparisons)
      gaps         = skill_comparisons.select { |c| c[:result] == 'gap' }
      matches      = skill_comparisons.select { |c| c[:result] == 'match' }
      exceeds      = skill_comparisons.select { |c| c[:result] == 'exceed' }
      not_assessed = skill_comparisons.select { |c| c[:result] == 'not_assessed' }

      prompt = build_narrative_prompt(gaps, matches, exceeds, not_assessed)

      begin
        response = @gemini_client.generate_content(prompt, temperature: 0.4)
        data = response.is_a?(Hash) ? response : JSON.parse(response.to_s)

        culture = data['culture_narrative'].presence
        overall = data['overall_narrative'].presence
        raise KeyError, 'narratives missing' if culture.nil? && overall.nil?

        { culture: culture, overall: overall, status: 'complete' }
      rescue StandardError => e
        # Never interpolate the response — it summarises the candidate's own
        # words and must not reach application logs.
        Rails.logger.error("[N13] Narrative generation failed (#{e.class.name}) — using fallback")
        {
          culture: nil,
          overall: generate_fallback_narrative(skill_comparisons),
          status:  'fallback'
        }
      end
    end

    def build_narrative_prompt(gaps, matches, exceeds, not_assessed)
      vacancy = @vacancy

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

        The "not assessed" skills carry no evidence either way. Do not describe
        them as weaknesses and do not treat their absence as a negative signal.

        Write two short narrative paragraphs:
        1. culture_narrative: 2-3 sentences on culture/competency fit based on the comparison patterns.
        2. overall_narrative: 2-3 sentence overall hiring recommendation summary.
           If any skills were not assessed, say so explicitly — the reader must
           not mistake this for a complete evaluation.

        OUTPUT (JSON only):
        {
          "culture_narrative": "...",
          "overall_narrative": "..."
        }
      PROMPT
    end

    # Reached whenever the model call fails, which in practice is the state an
    # assessor is most likely to be reading during an incident.
    #
    # The previous version counted matches, exceeds and gaps and stopped
    # there — so a six-skill role with two unassessed skills reported
    # "1 match, 1 exceeds, 2 gaps" and the reader had no way to notice that
    # two of the requirements were never examined at all.
    def generate_fallback_narrative(comparisons)
      total        = comparisons.count
      matches      = comparisons.count { |c| c[:result] == 'match' }
      exceeds      = comparisons.count { |c| c[:result] == 'exceed' }
      gaps         = comparisons.count { |c| c[:result] == 'gap' }
      not_assessed = comparisons.count { |c| c[:result] == 'not_assessed' }

      return 'This role has no required skills recorded, so there is nothing to compare.' if total.zero?

      parts = ["Against #{total} required #{'skill'.pluralize(total)}, " \
               "the interview evidenced #{matches} #{'match'.pluralize(matches)}, " \
               "#{exceeds} above requirement and #{gaps} below."]

      if not_assessed.positive?
        labels = comparisons.select { |c| c[:result] == 'not_assessed' }.map { |c| c[:skill_label] }
        parts << "#{not_assessed} #{'skill'.pluralize(not_assessed)} " \
                 "(#{labels.join(', ')}) #{not_assessed == 1 ? 'was' : 'were'} not assessed " \
                 'and carry no evidence in either direction.'
      end

      parts << 'An AI narrative could not be generated for this report, so this is a mechanical summary.'
      parts.join(' ')
    end
  end
end
