# frozen_string_literal: true

module FitGap
  # N13: Generates a fit/gap report comparing a portfolio against a vacancy.
  # Verdicts come from FitGap::Comparator (rule-based, evidence-aware);
  # Gemini Flash only writes the narrative around them.
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
      skill_comparisons = Comparator.new(portfolio: @portfolio, vacancy: @vacancy).call
      narratives        = generate_narratives(skill_comparisons)

      report = FitGapReport.find_or_initialize_by(
        portfolio_id: @portfolio.id,
        vacancy_id:   @vacancy.id
      )

      report.update!(
        skill_comparisons:  skill_comparisons,
        culture_narrative:  narratives[:culture],
        overall_narrative:  narratives[:overall],
        comparator_version: Comparator::VERSION,
        generated_at:       Time.current
      )

      Rails.logger.info("[N13] Fit/gap report generated: portfolio=#{@portfolio.id} vacancy=#{@vacancy.id}")
      report
    end

    private

    def generate_narratives(skill_comparisons)
      if skill_comparisons.empty?
        return { culture: nil, overall: 'This vacancy has no skill requirements yet, so there is nothing to compare.' }
      end

      groups = skill_comparisons.group_by { |c| c[:result] }
      prompt = build_narrative_prompt(groups)

      begin
        response = @gemini_client.generate_content(prompt, temperature: 0.4)
        data = response.is_a?(Hash) ? response : JSON.parse(response)
        overall = data['overall_narrative'].presence || generate_fallback_narrative(skill_comparisons)
        { culture: data['culture_narrative'].presence, overall: overall }
      rescue => e
        Rails.logger.error("[N13] Narrative generation failed: #{e.class}")
        { culture: nil, overall: generate_fallback_narrative(skill_comparisons) }
      end
    end

    def build_narrative_prompt(groups)
      vacancy = @vacancy
      list = ->(result, &fmt) { Array(groups[result]).map(&fmt).join(', ') }
      count = ->(result) { Array(groups[result]).size }

      <<~PROMPT
        You are writing a fit/gap analysis narrative for a candidate evaluation.

        ROLE: #{vacancy.role_title}
        #{vacancy.culture_dimensions.present? ? "CULTURE EXPECTATIONS:\n#{vacancy.culture_dimensions}\n" : ""}
        #{vacancy.competency_expectations.present? ? "COMPETENCY EXPECTATIONS:\n#{vacancy.competency_expectations}\n" : ""}

        SKILL COMPARISON RESULTS (final; do not re-rate any skill):
        - Matches (#{count.('match')}): #{list.('match') { |c| "#{c[:skill_label]} (L#{c[:candidate_level]})" }}
        - Gaps (#{count.('gap')}): #{list.('gap') { |c| "#{c[:skill_label]}: candidate L#{c[:candidate_level]} vs expected L#{c[:expected_level]}" }}
        - Exceeds (#{count.('exceed')}): #{list.('exceed') { |c| "#{c[:skill_label]}: candidate L#{c[:candidate_level]} vs expected L#{c[:expected_level]}" }}
        - Needs review (#{count.('insufficient_evidence')}): #{list.('insufficient_evidence') { |c| c[:skill_label] }}
        - Not assessed (#{count.('not_assessed')}): #{list.('not_assessed') { |c| c[:skill_label] }}

        RULES:
        - "Needs review" means the interview touched the skill too briefly to rate it reliably.
          "Not assessed" means the interview did not cover it. Both are open questions for the
          hiring team, not evidence of weakness. Never describe them as gaps or shortcomings.
        - Only skills listed under Gaps may be described as falling short.
        - Do not infer personal attributes (age, gender, background) and do not name the candidate.

        Write two short narrative paragraphs:
        1. culture_narrative: 2-3 sentences on culture/competency fit based on the comparison patterns.
        2. overall_narrative: 2-3 sentence overall summary that names any open questions.

        OUTPUT (JSON only):
        {
          "culture_narrative": "...",
          "overall_narrative": "..."
        }
      PROMPT
    end

    def generate_fallback_narrative(comparisons)
      count = ->(*results) { comparisons.count { |c| results.include?(c[:result]) } }
      total  = comparisons.size
      review = count.('insufficient_evidence')
      unseen = count.('not_assessed')

      below  = count.('gap')

      summary = "#{count.('match', 'exceed')} of #{total} required skills meet or exceed the expected level; " \
                "#{below} #{below == 1 ? 'falls' : 'fall'} below it."
      open = []
      open << "#{review} #{review == 1 ? 'needs' : 'need'} assessor review" if review.positive?
      open << "#{unseen} #{unseen == 1 ? 'was' : 'were'} not covered in the interview" if unseen.positive?
      return summary if open.empty?

      "#{summary} Still open: #{open.join(' and ')}. These are open questions, not weaknesses."
    end
  end
end
