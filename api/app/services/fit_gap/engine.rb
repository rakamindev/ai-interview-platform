# frozen_string_literal: true

require "digest"

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
      fingerprint       = compute_fingerprint

      # Serialize concurrent callers on one (portfolio, vacancy) pair.
      # pg_advisory_xact_lock is transaction-scoped: it is only held while a
      # transaction is open, so the lock MUST wrap the find-or-create below.
      # Without the surrounding transaction the SELECT would autocommit and the
      # lock would release before the unique index is touched, letting two
      # racers both insert and raise RecordNotUnique.
      #
      # Note: We use a deterministic 64-bit signed integer derived from SHA256
      # rather than Ruby's String#hash (which has a per-process randomized seed)
      # so that Puma web workers and Sidekiq background workers across processes
      # serialize on the exact same lock key.
      lock_key = advisory_lock_key

      report = ActiveRecord::Base.transaction do
        ActiveRecord::Base.connection.execute(
          ActiveRecord::Base.sanitize_sql_array(["SELECT pg_advisory_xact_lock(?)", lock_key])
        )

        r = FitGapReport.find_or_initialize_by(
          portfolio_id: @portfolio.id,
          vacancy_id:   @vacancy.id
        )

        r.update!(
          skill_comparisons: skill_comparisons,
          culture_narrative: narratives[:culture],
          overall_narrative: narratives[:overall],
          generated_at:      Time.current,
          source_fingerprint: fingerprint
        )
        r
      end

      Rails.logger.info("[N13] Fit/gap report generated: portfolio=#{@portfolio.id} vacancy=#{@vacancy.id} fingerprint=#{fingerprint}")
      report
    end

    private

    def build_skill_comparisons
      vacancy_skills = @vacancy.vacancy_skills.index_by(&:skill_label)
      portfolio_skills = effective_portfolio_skills  # includes overrides

      comparisons = vacancy_skills.map do |label, vacancy_skill|
        portfolio_skill = find_portfolio_skill(portfolio_skills, label, vacancy_skill.skill_id)

        if portfolio_skill
          candidate_level  = portfolio_skill[:effective_level]
          expected_level   = vacancy_skill.expected_level
          delta            = candidate_level - expected_level
          result           = delta == 0 ? 'match' : (delta > 0 ? 'exceed' : 'gap')
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
          overridden:      portfolio_skill ? !!portfolio_skill[:overridden] : false
        }
      end

      comparisons
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
      portfolio_skills.find { |s| s[:skill_id] == skill_id && skill_id.present? } ||
        portfolio_skills.find { |s| s[:skill_label].downcase == label.downcase }
    end

    # Hash of every input that affects the generated report. Changing any skill
    # level, override level, or override timestamp busts the fingerprint.
    # AssessorOverride carries `overridden_at` (no updated_at column), so we use
    # that — including it is what makes the staleness check catch a newly-added
    # or edited human override (AC8).
    def compute_fingerprint
      parts = []

      parts += @portfolio.portfolio_skills.order(:id)
                       .pluck(:ai_level)
                       .map { |lvl| "#{lvl}" }

      parts += AssessorOverride.joins(:portfolio_skill)
                       .where(portfolio_skills: { portfolio_id: @portfolio.id })
                       .order(:id)
                       .pluck(:override_level, :overridden_at)
                       .map { |lvl, ts| "o#{lvl}@#{ts.to_i}" }

      parts += @vacancy.vacancy_skills.order(:id)
                       .pluck(:skill_label, :expected_level)
                       .map { |lbl, lvl| "#{lbl}:#{lvl}" }

      Digest::SHA256.hexdigest(parts.join("|"))[0, 16]
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
      gaps    = comparisons.count { |c| c[:result] == 'gap' }
      matches = comparisons.count { |c| c[:result] == 'match' }
      exceeds = comparisons.count { |c| c[:result] == 'exceed' }

      "Candidate shows #{matches} skill matches, #{exceeds} exceeds, and #{gaps} gaps against role requirements."
    end

    # Deterministic 64-bit signed integer key for pg_advisory_xact_lock(bigint).
    # Uses SHA256 rather than Ruby's process-salted Object#hash to ensure cross-process
    # synchronization across all Puma workers and Sidekiq threads.
    def advisory_lock_key
      Digest::SHA256.digest("fitgap:#{@portfolio.id}:#{@vacancy.id}")[0...8].unpack1('q>')
    end
  end
end
