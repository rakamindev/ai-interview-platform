# frozen_string_literal: true

module FitGap
  # N13: Generates a fit/gap report comparing a portfolio against a vacancy.
  #
  # Reliability hardening:
  #  - Deterministic skill comparisons are persisted FIRST, before any model call.
  #  - Narrative generation is optional: if Gemini fails, comparisons remain and
  #    the report is marked `failed` (with the error) so the UI can show a retry
  #    without losing the deterministic result.
  #  - The worker atomically claims pending/retryable work (unique portfolio+vacancy
  #    key prevents duplicate reports; duplicate workers exit without a model call).
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

      # 1. Persist the deterministic comparisons immediately (lifecycle: generating).
      report = FitGapReport.find_or_initialize_by(
        portfolio_id: @portfolio.id,
        vacancy_id:   @vacancy.id
      )
      report.update!(
        skill_comparisons: skill_comparisons,
        generation_status: 'generating',
        generation_error:  nil,
        generated_at:      nil
      )

      # 2. Generate the optional narrative. Failure is non-fatal to the
      #    comparisons — mark failed so the UI can offer retry.
      narratives = generate_narratives(skill_comparisons)

      report.update!(
        culture_narrative: narratives[:culture],
        overall_narrative: narratives[:overall],
        generation_status: 'complete',
        generation_error:  nil,
        generated_at:      Time.current
      )

      Rails.logger.info("[N13] Fit/gap report generated: portfolio=#{@portfolio.id} vacancy=#{@vacancy.id}")
      report
    end

    private

    def build_skill_comparisons
      vacancy_skills = @vacancy.vacancy_skills.index_by(&:skill_label)
      portfolio_skills = effective_portfolio_skills  # includes overrides/reviews

      comparisons = vacancy_skills.map do |label, vacancy_skill|
        portfolio_skill = find_portfolio_skill(portfolio_skills, label, vacancy_skill.skill_id)

        if portfolio_skill
          candidate_level  = portfolio_skill[:effective_level]
          expected_level   = vacancy_skill.expected_level
          if candidate_level.nil?
            result          = 'not_assessed'
            delta           = nil
          else
            delta           = candidate_level - expected_level
            result          = delta == 0 ? 'match' : (delta > 0 ? 'exceed' : 'gap')
          end
        else
          candidate_level = nil
          expected_level  = vacancy_skill.expected_level
          delta           = nil
          result          = 'not_assessed'
        end

        {
          skill_label:     label,
          skill_id:        vacancy_skill.skill_id,
          candidate_level: candidate_level,
          expected_level:  expected_level,
          result:          result,
          delta:           delta,
          confidence:      portfolio_skill&.dig(:confidence),
          review_outcome:  portfolio_skill&.dig(:review_outcome),
          level_source:    portfolio_skill&.dig(:level_source)
        }
      end

      comparisons
    end

    # Returns portfolio skills with reviews applied.
    def effective_portfolio_skills
      @portfolio.portfolio_skills.includes(:assessor_override).map do |skill|
        override = skill.assessor_override
        {
          id:              skill.id,
          skill_id:        skill.skill_id,
          skill_label:     skill.skill_label,
          ai_level:        skill.ai_level,
          effective_level: override ? override.effective_level : skill.ai_level,
          confidence:      skill.ai_confidence,
          overridden:      override.present?,
          review_outcome:  override&.outcome,
          level_source:    override ? (override.confirmed? ? 'ai_confirmed' : (override.adjusted? ? 'human_adjusted' : 'not_assessed')) : 'ai_generated'
        }
      end
    end

    def find_portfolio_skill(portfolio_skills, label, skill_id)
      portfolio_skills.find { |s| s[:skill_id] == skill_id && skill_id.present? } ||
        portfolio_skills.find { |s| s[:skill_label].downcase == label.downcase }
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
        { culture: data['culture_narrative'], overall: data['overall_narrative'] }
      rescue => e
        Rails.logger.error("[N13] Narrative generation failed: #{e.message}")
        # Keep comparisons; surface the failure so the UI can offer retry.
        raise NarrativeGenerationError, e.message
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

        Write two short narrative paragraphs:
        1. culture_narrative: 2-3 sentences on culture/competency fit based on the comparison patterns.
        2. overall_narrative: 2-3 sentence overall summary of strengths and gaps.

        This is decision support for a human reviewer, NOT an automated hire/no-hire verdict.
        Never recommend hiring or rejecting. Describe evidence and fit only.

        OUTPUT (JSON only):
        {
          "culture_narrative": "...",
          "overall_narrative": "..."
        }
      PROMPT
    end

    # Narrative failure — a domain error so the worker can distinguish it from
    # infrastructure failures and mark the report failed (retryable) instead of
    # re-enqueuing the whole deterministic comparison.
    class NarrativeGenerationError < StandardError; end
  end
end
