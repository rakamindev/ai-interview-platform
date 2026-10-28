# frozen_string_literal: true

module FitGap
  # N13: Generates a fit/gap report comparing a portfolio against a vacancy.
  # Uses rule-based comparison for skill levels + Gemini Flash for culture narrative.
  class Engine
    def initialize(portfolio:, vacancy:, gemini_client: nil)
      @portfolio = portfolio
      @vacancy   = vacancy
      @gemini_client = gemini_client || Gemini::HttpClient.new(
        model:   ENV.fetch('GEMINI_FLASH_MODEL', 'gemini-3.8-flash'),
        # gemini-2.0-flash-001 (the prior default) was retired by Google and
        # returns 404. A 30s timeout against the live replacement model was
        # measured to fail reliably (Gemini::HttpClient::TimeoutError after
        # 120s in the same test run) — the narrative call silently fell back
        # to generate_fallback_narrative every time. 240s matches the
        # generator's timeout; both run as Sidekiq jobs with a 300s job limit.
        timeout: 240
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
        generated_at:      Time.current
      )

      Rails.logger.info("[N13] Fit/gap report generated: portfolio=#{@portfolio.id} vacancy=#{@vacancy.id}")
      report
    end

    private

    def build_skill_comparisons
      vacancy_skills   = @vacancy.vacancy_skills.index_by(&:skill_label)
      portfolio_skills = effective_portfolio_skills  # includes overrides

      vacancy_skills.map do |label, vacancy_skill|
        portfolio_skill = find_portfolio_skill(portfolio_skills, label, vacancy_skill.skill_id)
        build_comparison(vacancy_skill: vacancy_skill, skill_label: label, portfolio_skill: portfolio_skill)
      end
    end

    # A human override speaks for any underlying assessment_status — an
    # assessor may judge a skill the AI never managed to. Short of that, an
    # unscored skill (not_assessed) or a weakly-covered one
    # (insufficient_evidence) is reported as exactly that, never forced
    # through the match/gap/exceed level comparison with a fabricated level.
    def build_comparison(vacancy_skill:, skill_label:, portfolio_skill:)
      expected_level = vacancy_skill.expected_level
      overridden     = portfolio_skill ? portfolio_skill[:overridden] : false

      base = {
        skill_label:    skill_label,
        skill_id:       vacancy_skill.skill_id,
        expected_level: expected_level,
        ai_level:       portfolio_skill&.dig(:ai_level),
        confidence:     portfolio_skill&.dig(:confidence),
        evidence_count: portfolio_skill ? portfolio_skill[:evidence_count] : 0,
        is_override:    overridden
      }

      status = portfolio_skill&.dig(:assessment_status)

      if !overridden && (portfolio_skill.nil? || status == "not_assessed")
        return base.merge(candidate_level: nil, provisional_level: nil, result: "not_assessed", delta: nil)
      end

      if !overridden && status == "insufficient_evidence"
        return base.merge(candidate_level: nil, provisional_level: portfolio_skill[:ai_level],
                           result: "insufficient_evidence", delta: nil)
      end

      candidate_level = portfolio_skill[:effective_level]
      delta  = candidate_level - expected_level
      result = delta.zero? ? "match" : (delta.positive? ? "exceed" : "gap")

      base.merge(candidate_level: candidate_level, provisional_level: nil, result: result, delta: delta)
    end

    # Returns portfolio skills with overrides applied.
    def effective_portfolio_skills
      @portfolio.portfolio_skills.includes(:assessor_override).map do |skill|
        override = skill.assessor_override
        {
          id:                skill.id,
          skill_id:          skill.skill_id,
          skill_label:       skill.skill_label,
          ai_level:          skill.ai_level,
          assessment_status: skill.assessment_status,
          effective_level:   override ? override.override_level : skill.ai_level,
          confidence:        skill.ai_confidence,
          evidence_count:    skill.evidence_quotes.size,
          overridden:        override.present?
        }
      end
    end

    def find_portfolio_skill(portfolio_skills, label, skill_id)
      portfolio_skills.find { |s| s[:skill_id] == skill_id && skill_id.present? } ||
        portfolio_skills.find { |s| s[:skill_label].downcase == label.downcase }
    end

    def generate_narratives(skill_comparisons)
      gaps        = skill_comparisons.select { |c| c[:result] == 'gap' }
      matches     = skill_comparisons.select { |c| c[:result] == 'match' }
      exceeds     = skill_comparisons.select { |c| c[:result] == 'exceed' }
      unsure      = skill_comparisons.select { |c| c[:result] == 'insufficient_evidence' }
      not_assessed = skill_comparisons.select { |c| c[:result] == 'not_assessed' }

      prompt = build_narrative_prompt(gaps, matches, exceeds, unsure, not_assessed)

      begin
        response = @gemini_client.generate_content(prompt, temperature: 0.4)
        data = response.is_a?(Hash) ? response : JSON.parse(response)
        { culture: data['culture_narrative'], overall: data['overall_narrative'] }
      rescue => e
        Rails.logger.error("[N13] Narrative generation failed: #{e.message}")
        { culture: nil, overall: generate_fallback_narrative(skill_comparisons) }
      end
    end

    def build_narrative_prompt(gaps, matches, exceeds, unsure, not_assessed)
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
        - Insufficient evidence (#{unsure.count}): #{unsure.map { |c| c[:skill_label] }.join(', ')}
        - Not assessed / never reached in the interview (#{not_assessed.count}): #{not_assessed.map { |c| c[:skill_label] }.join(', ')}

        IMPORTANT: "Insufficient evidence" and "not assessed" are NOT weaknesses
        or gaps — they mean the interview ran out of time or the AI could not
        gather enough signal, not that the candidate performed poorly. Do not
        describe these skills as deficiencies. If relevant, note them as
        follow-up areas for a human interviewer rather than as findings about
        the candidate's ability.

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
      counts = Hash.new(0)
      comparisons.each { |c| counts[c[:result]] += 1 }

      parts = [
        describe_count(counts["match"], "match", "matches"),
        describe_count(counts["exceed"], "exceed", "exceeds"),
        describe_count(counts["gap"], "gap", "gaps"),
        describe_count(counts["insufficient_evidence"], "skill with insufficient interview evidence",
                       "skills with insufficient interview evidence"),
        describe_count(counts["not_assessed"], "skill never reached in the interview",
                        "skills never reached in the interview"),
      ].compact

      "Candidate shows #{parts.to_sentence}."
    end

    def describe_count(count, singular, plural)
      return nil if count.zero?

      "#{count} #{count == 1 ? singular : plural}"
    end
  end
end
