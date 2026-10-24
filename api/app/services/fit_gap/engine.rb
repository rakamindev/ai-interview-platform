# frozen_string_literal: true

module FitGap
  # N13: Generates a fit/gap report comparing a portfolio against a vacancy.
  # Uses rule-based comparison for skill levels. Gemini may choose a supported
  # emphasis, but published prose is assembled only from verified comparisons.
  class Engine
    def initialize(portfolio:, vacancy:, gemini_client: nil)
      @portfolio = portfolio
      @vacancy   = vacancy
      @gemini_client = gemini_client
    end

    # Returns the FitGapReport record.
    def call
      attributes = build
      report = FitGapReport.find_or_initialize_by(
        portfolio_id: @portfolio.id,
        vacancy_id: @vacancy.id
      )
      report.update!(attributes.merge(source_digest: FitGap::SourceDigest.call(portfolio: @portfolio, vacancy: @vacancy)))

      Rails.logger.info("[N13] Fit/gap report generated: portfolio=#{@portfolio.id} vacancy=#{@vacancy.id}")
      report
    end

    # Pure report attributes for the worker to commit only after its source check.
    def build
      raise ArgumentError, 'Portfolio and vacancy belong to different tenants' if @portfolio.session.tenant_id != @vacancy.tenant_id

      skill_comparisons = build_skill_comparisons
      narratives        = generate_narratives(skill_comparisons)

      {
        skill_comparisons: skill_comparisons,
        culture_narrative: narratives[:culture],
        overall_narrative: narratives[:overall],
        generated_at:      Time.current
      }
    end

    private

    def build_skill_comparisons
      FitGap::ComparisonBuilder.new(
        vacancy_skills: @vacancy.vacancy_skills,
        portfolio_skills: @portfolio.portfolio_skills.includes(:assessor_override),
        coverage_maps: @portfolio.session.coverage_maps,
        candidate_turns: @portfolio.session.transcript_turns.where(speaker: 'candidate').pluck(:text)
      ).call
    end

    def generate_narratives(skill_comparisons)
      return { culture: nil, overall: 'No role skills are configured for comparison.' } if skill_comparisons.empty?

      gaps    = skill_comparisons.select { |c| c[:result] == 'gap' }
      matches = skill_comparisons.select { |c| c[:result] == 'match' }
      exceeds = skill_comparisons.select { |c| c[:result] == 'exceed' }
      not_assessed = skill_comparisons.select { |c| c[:result] == 'not_assessed' }

      prompt = build_narrative_prompt(gaps, matches, exceeds, not_assessed)

      begin
        client = @gemini_client || Gemini::HttpClient.new(
          model: ENV.fetch('GEMINI_FLASH_MODEL', 'gemini-2.0-flash-001'), timeout: 30
        )
        response = client.generate_content(prompt, temperature: 0.4)
        data = response.is_a?(Hash) ? response : JSON.parse(response)
        focus = data.is_a?(Hash) ? data['focus'] : nil
        available = { 'gaps' => gaps, 'matches' => matches, 'exceeds' => exceeds,
                      'not_assessed' => not_assessed }
        raise ArgumentError, 'Unsupported model focus' unless available.key?(focus) && available[focus].any?

        emphasis = {
          'gaps' => 'Review the listed skill gaps against the role requirements.',
          'matches' => 'Review the listed skill matches and their evidence.',
          'exceeds' => 'Review the listed skills above the required level.',
          'not_assessed' => 'Collect more evidence for skills not yet assessed.'
        }.fetch(focus)

        { culture: nil, overall: "#{generate_fallback_narrative(skill_comparisons)} #{emphasis}" }
      rescue => e
        Rails.logger.error("[N13] Narrative generation failed: #{e.class}")
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
        - Gaps (#{gaps.count}): #{gaps.map { |c| "#{c[:skill_label]}: candidate L#{c[:candidate_level]} vs expected L#{c[:required_level]} (delta #{c[:delta]})" }.join(', ')}
        - Exceeds (#{exceeds.count}): #{exceeds.map { |c| "#{c[:skill_label]}: candidate L#{c[:candidate_level]} vs expected L#{c[:required_level]} (+#{c[:delta]})" }.join(', ')}
        - Not assessed (#{not_assessed.count}): #{not_assessed.map { |c| c[:skill_label] }.join(', ')}

        Choose one supported comparison category to emphasize. Return JSON only:
        { "focus": "gaps" }
        Allowed values: gaps, matches, exceeds, not_assessed. Choose only a nonempty category.
        Do not return prose; the application constructs the final narrative.
      PROMPT
    end

    def generate_fallback_narrative(comparisons)
      gaps    = comparisons.count { |c| c[:result] == 'gap' }
      matches = comparisons.count { |c| c[:result] == 'match' }
      exceeds = comparisons.count { |c| c[:result] == 'exceed' }
      unassessed = comparisons.count { |c| c[:result] == 'not_assessed' }

      "Evidence supports #{matches} skill matches, #{exceeds} exceeds, and #{gaps} gaps; #{unassessed} #{unassessed == 1 ? 'skill needs' : 'skills need'} more assessment. Culture fit is not established by this comparison."
    end
  end
end
