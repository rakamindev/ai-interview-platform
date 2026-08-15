# frozen_string_literal: true

module FitGap
  # N13: Compares a portfolio against a vacancy. Rule-based on skill levels,
  # Gemini Flash for the narrative.
  #
  # This service decides what a hiring report says about a person, and it had
  # four defects that changed that verdict:
  #
  #   1. It emitted `expected_level` and `confidence` while the client read
  #      `required_level` and `is_override`. Neither key was ever sent, so the
  #      Required column rendered blank on every row and the override marker
  #      never appeared — beneath a legend promising it did.
  #
  #   2. A skill with no evidence was compared anyway. Combined with the old
  #      generator's fabricated L1, a skill nobody asked about became a hard gap.
  #      Absence of evidence is now never reported as a deficiency.
  #
  #   3. It iterated vacancy skills only, so a candidate's strengths outside the
  #      vacancy were silently dropped from their own report.
  #
  #   4. Label matching was case- and whitespace-sensitive, so "React " and
  #      "React" were different skills.
  class Engine
    RESULT_MATCH        = 'match'
    RESULT_GAP          = 'gap'
    RESULT_EXCEED       = 'exceed'
    RESULT_NOT_ASSESSED = 'not_assessed'
    RESULT_ADDITIONAL   = 'additional'

    def initialize(portfolio:, vacancy:, gemini_client: nil)
      @portfolio = portfolio
      @vacancy   = vacancy
      @gemini_client = gemini_client || Gemini.client_for(
        model:   ENV.fetch('GEMINI_FLASH_MODEL', 'gemini-2.0-flash-001'),
        timeout: 30
      )
    end

    def call
      comparisons = build_skill_comparisons
      narrative   = generate_narratives(comparisons)

      report = FitGapReport.find_or_initialize_by(portfolio_id: @portfolio.id, vacancy_id: @vacancy.id)

      # The unique index on (portfolio_id, vacancy_id) means two concurrent
      # regenerations race here; the transaction turns that into a clean retry
      # rather than a half-written report.
      ActiveRecord::Base.transaction do
        report.update!(
          skill_comparisons: comparisons,
          culture_narrative: narrative[:culture],
          overall_narrative: narrative[:overall],
          narrative_status:  narrative[:status],
          generated_at:      Time.current
        )
      end

      Rails.logger.info(
        "[N13] Fit/gap generated: portfolio=#{@portfolio.id} vacancy=#{@vacancy.id} " \
        "comparisons=#{comparisons.size} narrative=#{narrative[:status]}"
      )
      report
    end

    private

    # ── Comparison ────────────────────────────────────────────────────────────

    def build_skill_comparisons
      portfolio_skills = effective_portfolio_skills
      matched_keys     = []

      required = @vacancy.vacancy_skills.map do |vacancy_skill|
        skill = find_portfolio_skill(portfolio_skills, vacancy_skill)
        matched_keys << key_for(skill[:skill_label]) if skill

        comparison_for(vacancy_skill, skill)
      end

      required + additional_strengths(portfolio_skills, matched_keys)
    end

    def comparison_for(vacancy_skill, skill)
      required_level = vacancy_skill.expected_level

      base = {
        skill_label:    vacancy_skill.skill_label,
        skill_id:       vacancy_skill.skill_id,
        required_level: required_level,
        # Retained for one release so an unmigrated client does not break.
        # Deprecated: read required_level.
        expected_level: required_level,
        in_vacancy:     true
      }

      # No portfolio row, or a row that was never assessed, are the same thing
      # from the assessor's point of view: there is nothing to compare. Neither
      # may be reported as a gap — a gap is a finding, and this is its absence.
      if skill.nil? || skill[:assessment_state] != PortfolioSkill::ASSESSED
        return base.merge(
          candidate_level:  nil,
          ai_level:         nil,
          override_level:   nil,
          is_override:      false,
          confidence:       nil,
          assessment_state: skill&.dig(:assessment_state) || PortfolioSkill::NOT_PROBED,
          result:           RESULT_NOT_ASSESSED,
          delta:            nil
        )
      end

      candidate_level = skill[:effective_level]
      delta           = candidate_level - required_level

      base.merge(
        candidate_level:  candidate_level,
        ai_level:         skill[:ai_level],
        override_level:   skill[:override_level],
        is_override:      skill[:is_override],
        confidence:       skill[:confidence],
        assessment_state: skill[:assessment_state],
        result:           delta.zero? ? RESULT_MATCH : (delta.positive? ? RESULT_EXCEED : RESULT_GAP),
        delta:            delta
      )
    end

    # Assessed skills the vacancy never asked for. Dropping these meant a
    # candidate's report omitted what they were actually good at.
    def additional_strengths(portfolio_skills, matched_keys)
      portfolio_skills
        .reject { |skill| matched_keys.include?(key_for(skill[:skill_label])) }
        .select { |skill| skill[:assessment_state] == PortfolioSkill::ASSESSED }
        .map do |skill|
          {
            skill_label:      skill[:skill_label],
            skill_id:         skill[:skill_id],
            required_level:   nil,
            expected_level:   nil,
            candidate_level:  skill[:effective_level],
            ai_level:         skill[:ai_level],
            override_level:   skill[:override_level],
            is_override:      skill[:is_override],
            confidence:       skill[:confidence],
            assessment_state: skill[:assessment_state],
            result:           RESULT_ADDITIONAL,
            delta:            nil,
            in_vacancy:       false,
            is_discovered:    skill[:is_discovered]
          }
        end
    end

    def effective_portfolio_skills
      @portfolio.portfolio_skills.live.includes(:assessor_override).map do |skill|
        override = skill.assessor_override

        {
          id:               skill.id,
          skill_id:         skill.skill_id,
          skill_label:      skill.skill_label,
          is_discovered:    skill.is_discovered,
          assessment_state: skill.assessment_state,
          ai_level:         skill.ai_level,
          override_level:   override&.override_level,
          effective_level:  skill.effective_level,
          confidence:       skill.ai_confidence,
          is_override:      override.present?
        }
      end
    end

    def find_portfolio_skill(portfolio_skills, vacancy_skill)
      by_id = vacancy_skill.skill_id.presence && portfolio_skills.find do |skill|
        skill[:skill_id].present? && skill[:skill_id] == vacancy_skill.skill_id
      end

      by_id || portfolio_skills.find { |skill| key_for(skill[:skill_label]) == key_for(vacancy_skill.skill_label) }
    end

    def key_for(label) = label.to_s.strip.downcase

    # ── Narrative ─────────────────────────────────────────────────────────────

    def generate_narratives(comparisons)
      grouped = comparisons.group_by { |c| c[:result] }
      prompt  = build_narrative_prompt(grouped)

      response = @gemini_client.generate_content(prompt, temperature: 0.4)
      data     = response.is_a?(Hash) ? response : JSON.parse(response)

      culture = data['culture_narrative'].presence
      overall = data['overall_narrative'].presence
      raise KeyError, 'narrative keys missing from model response' if culture.nil? && overall.nil?

      { culture: culture, overall: overall, status: 'complete' }
    rescue StandardError => e
      Rails.logger.error("[N13] Narrative generation failed: #{e.class} #{e.message}")

      # culture stays nil and the status says why. Previously the rule-based
      # fallback was returned as `overall` and the client rendered it under the
      # culture heading, presenting arithmetic as analysis.
      { culture: nil, overall: fallback_narrative(grouped), status: 'failed' }
    end

    def build_narrative_prompt(grouped)
      matches      = grouped[RESULT_MATCH]        || []
      gaps         = grouped[RESULT_GAP]          || []
      exceeds      = grouped[RESULT_EXCEED]       || []
      not_assessed = grouped[RESULT_NOT_ASSESSED] || []

      <<~PROMPT
        You are writing a fit/gap analysis narrative for a candidate evaluation.

        ROLE: #{@vacancy.role_title}
        #{"CULTURE EXPECTATIONS:\n#{@vacancy.culture_dimensions}\n" if @vacancy.culture_dimensions.present?}
        #{"COMPETENCY EXPECTATIONS:\n#{@vacancy.competency_expectations}\n" if @vacancy.competency_expectations.present?}

        SKILL COMPARISON RESULTS:
        - Matches (#{matches.count}): #{matches.map { |c| "#{c[:skill_label]} (L#{c[:candidate_level]})" }.join(', ')}
        - Gaps (#{gaps.count}): #{gaps.map { |c| "#{c[:skill_label]}: L#{c[:candidate_level]} vs required L#{c[:required_level]}" }.join(', ')}
        - Exceeds (#{exceeds.count}): #{exceeds.map { |c| "#{c[:skill_label]}: L#{c[:candidate_level]} vs required L#{c[:required_level]}" }.join(', ')}
        - Not assessed (#{not_assessed.count}): #{not_assessed.map { |c| c[:skill_label] }.join(', ')}

        The "not assessed" skills produced no evidence in this interview. Do not
        describe them as weaknesses. Recommend covering them before a decision.

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

    def fallback_narrative(grouped)
      counts = {
        'match'        => (grouped[RESULT_MATCH]        || []).size,
        'exceed'       => (grouped[RESULT_EXCEED]       || []).size,
        'gap'          => (grouped[RESULT_GAP]          || []).size,
        'not assessed' => (grouped[RESULT_NOT_ASSESSED] || []).size
      }

      summary = counts.map { |label, count| "#{count} #{label}" }.join(', ')
      "Automated summary (narrative generation unavailable): #{summary} against the role requirements."
    end
  end
end
