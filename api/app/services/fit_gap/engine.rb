module FitGap
  class Engine
    class NarrativeGenerationError < StandardError
    end

    def initialize(portfolio:, vacancy:, gemini_client: nil, report: nil, generation_token: nil)
      @portfolio = portfolio
      @vacancy = vacancy
      @report = report
      @generation_token = generation_token
      @gemini_client = gemini_client || Gemini::HttpClient.new(
        model: ENV.fetch("GEMINI_FLASH_MODEL", "gemini-3.6-flash"),
        timeout: 30
      )
    end

    def call
      skill_comparisons = build_skill_comparisons
      narratives = generate_narratives(skill_comparisons)
      report = @report || find_or_initialize_report

      report.with_lock do
        return report if @generation_token && report.generation_token != @generation_token

        report.update!(
          skill_comparisons:,
          culture_narrative: narratives[:culture],
          overall_narrative: narratives[:overall],
          generated_at: Time.current,
          generation_status: "complete",
          generation_error: nil,
          generation_started_at: nil,
          generation_token: nil
        )
      end

      Rails.logger.info("[N13] Fit/gap report generated: portfolio=#{@portfolio.id} vacancy=#{@vacancy.id}")
      report
    end

    private

    def find_or_initialize_report
      FitGapReport.find_or_create_by!(portfolio_id: @portfolio.id, vacancy_id: @vacancy.id) do |record|
        record.skill_comparisons = []
        record.generation_status = "pending"
      end
    end

    def build_skill_comparisons
      portfolio_skills = effective_portfolio_skills
      vacancy_skills = @vacancy.vacancy_skills.order(:id).map do |skill|
        {
          skill_id: skill.skill_id,
          skill_label: skill.skill_label,
          expected_level: skill.expected_level
        }
      end

      Comparator.new(portfolio_skills:, vacancy_skills:).call
    end

    def effective_portfolio_skills
      @portfolio.portfolio_skills.includes(:assessor_override).map do |skill|
        override = skill.assessor_override
        rating_status = skill.respond_to?(:rating_status) ? skill.rating_status : "rated"

        {
          skill_id: skill.skill_id,
          skill_label: skill.skill_label,
          effective_level: override ? override.override_level : (rating_status == "rated" ? skill.ai_level : nil),
          confidence: skill.ai_confidence,
          overridden: override.present?,
          rating_status: override ? "rated" : rating_status
        }
      end
    end

    def generate_narratives(skill_comparisons)
      gaps = skill_comparisons.select { |comparison| comparison[:result] == "gap" }
      matches = skill_comparisons.select { |comparison| comparison[:result] == "match" }
      exceeds = skill_comparisons.select { |comparison| comparison[:result] == "exceed" }
      not_assessed = skill_comparisons.select { |comparison| comparison[:result] == "not_assessed" }
      prompt = build_narrative_prompt(gaps, matches, exceeds, not_assessed)

      response = @gemini_client.generate_content(prompt, temperature: 0.4)
      data = response.is_a?(Hash) ? response : JSON.parse(response)

      culture = normalize_narrative(data["culture_narrative"])
      overall = normalize_narrative(data["overall_narrative"])
      raise NarrativeGenerationError unless culture && overall

      { culture:, overall: }
    rescue NarrativeGenerationError
      raise
    rescue StandardError => e
      Rails.logger.error("[N13] Narrative generation failed: #{e.class}")
      raise NarrativeGenerationError, "Narrative generation failed"
    end

    def build_narrative_prompt(gaps, matches, exceeds, not_assessed)
      vacancy = @vacancy
      culture_dimensions = vacancy.culture_dimensions.to_s.strip.slice(0, 6000)
      competency_expectations = vacancy.competency_expectations.to_s.strip.slice(0, 6000)

      <<~PROMPT
        You are writing a fit/gap analysis narrative for a candidate evaluation.

        ROLE: #{vacancy.role_title}
        #{culture_dimensions.empty? ? "" : "CULTURE EXPECTATIONS:\n#{culture_dimensions}\n"}
        #{competency_expectations.empty? ? "" : "COMPETENCY EXPECTATIONS:\n#{competency_expectations}\n"}

        SKILL COMPARISON RESULTS:
        - Matches (#{matches.count}): #{matches.map { |comparison| "#{comparison[:skill_label]} (L#{comparison[:candidate_level]})" }.join(", ")}
        - Gaps (#{gaps.count}): #{gaps.map { |comparison| "#{comparison[:skill_label]}: candidate L#{comparison[:candidate_level]} vs expected L#{comparison[:required_level]} (delta #{comparison[:delta]})" }.join(", ")}
        - Exceeds (#{exceeds.count}): #{exceeds.map { |comparison| "#{comparison[:skill_label]}: candidate L#{comparison[:candidate_level]} vs expected L#{comparison[:required_level]} (+#{comparison[:delta]})" }.join(", ")}
        - Not assessed (#{not_assessed.count}): #{not_assessed.map { |comparison| comparison[:skill_label] }.join(", ")}

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

    def normalize_narrative(value)
      text = value.to_s.strip
      text.empty? ? nil : text.slice(0, 3000)
    end

  end
end
