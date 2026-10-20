# frozen_string_literal: true

require 'digest'

module FitGap
  # N13: builds the fit/gap report for one (portfolio, vacancy) pair.
  #
  # The work is split in two so that an AI failure can never hide the facts:
  #
  #   refresh_comparisons!  deterministic, no network, safe to run inside a request.
  #                         Creates/updates the report row (idempotent) and flags the
  #                         narrative "pending" when its inputs changed.
  #   generate_narrative!   calls Gemini. Never raises for model errors: it stores a
  #                         factual fallback and marks the narrative "failed" so the UI
  #                         can say so and offer a retry. Duplicate jobs are no-ops and a
  #                         result computed from stale inputs is discarded.
  class Engine
    MAX_NARRATIVE_CHARS = 1_500

    def initialize(portfolio:, vacancy:, gemini_client: nil)
      @portfolio     = portfolio
      @vacancy       = vacancy
      @gemini_client = gemini_client
    end

    # Convenience for callers that want everything inline (console, specs).
    def call
      refresh_comparisons!
      generate_narrative!
    end

    # Returns the FitGapReport. Narrative status becomes "pending" whenever the inputs
    # the narrative depends on changed (or the report is new); old narrative text is kept
    # so the UI can show it as "updating" instead of going blank.
    def refresh_comparisons!
      result = comparison_result
      report = find_or_build_report
      report.assign_attributes(
        skill_comparisons: result[:comparisons],
        summary:           result[:summary],
        generated_at:      Time.current
      )
      report.narrative_status = 'pending' if report.new_record? || report.narrative_digest != digest_for(result)
      save_idempotently!(report)
    end

    def generate_narrative!
      report = refresh_comparisons!
      result = comparison_result
      digest = digest_for(result)
      return report if report.narrative_status == 'ready' && report.narrative_digest == digest

      if result[:summary][:assessed].zero?
        # Nothing was assessed: there is nothing truthful for a model to say.
        return finish(report, digest, culture: nil, overall: nil, status: 'ready')
      end

      narratives = request_narratives(result)
      finish(report, digest, culture: narratives[:culture], overall: narratives[:overall], status: 'ready')
    rescue StandardError => e
      # Class name only: model/HTTP messages can echo prompt content (candidate data).
      Rails.logger.error("[N13] Narrative failed portfolio=#{@portfolio.id} vacancy=#{@vacancy.id}: #{e.class}")
      fail_narrative(report, result, e)
    end

    private

    def comparison_result
      Comparator.call(vacancy_skills: vacancy_skill_rows, portfolio_skills: portfolio_skill_rows)
    end

    def vacancy_skill_rows
      @vacancy.vacancy_skills.map do |s|
        { skill_id: s.skill_id, skill_label: s.skill_label, expected_level: s.expected_level }
      end
    end

    # Overrides applied here once; the comparator only sees the effective level.
    def portfolio_skill_rows
      @portfolio.portfolio_skills.includes(:assessor_override).map do |s|
        {
          skill_id:       s.skill_id,
          skill_label:    s.skill_label,
          ai_level:       s.ai_level,
          override_level: s.assessor_override&.override_level,
          confidence:     s.ai_confidence
        }
      end
    end

    # Everything the narrative text depends on. If it is unchanged the narrative is still true.
    def digest_for(result)
      Digest::SHA256.hexdigest(
        [result[:comparisons], @vacancy.role_title, @vacancy.culture_dimensions,
         @vacancy.competency_expectations, language].to_json
      )
    end

    def find_or_build_report
      FitGapReport.find_or_initialize_by(portfolio_id: @portfolio.id, vacancy_id: @vacancy.id)
    end

    # Two jobs racing to create the same row hit the unique index; the loser reloads the winner's row.
    def save_idempotently!(report)
      report.save!
      report
    rescue ActiveRecord::RecordNotUnique
      existing = FitGapReport.find_by!(portfolio_id: @portfolio.id, vacancy_id: @vacancy.id)
      existing.update!(skill_comparisons: report.skill_comparisons, summary: report.summary,
                       generated_at: report.generated_at)
      existing
    end

    def finish(report, digest, culture:, overall:, status:)
      report.reload
      # Inputs changed while the model was thinking (e.g. an override landed): a newer job owns the write.
      return report if digest_for(comparison_result) != digest

      report.update!(culture_narrative: culture, overall_narrative: overall, narrative_status: status,
                     narrative_digest: digest, generation_error: nil)
      Rails.logger.info("[N13] Fit/gap ready portfolio=#{@portfolio.id} vacancy=#{@vacancy.id} status=#{status}")
      report
    end

    def fail_narrative(report, result, error)
      report ||= refresh_comparisons!
      result ||= comparison_result
      report.reload
      report.update!(
        culture_narrative: nil,
        overall_narrative: fallback_narrative(result[:summary]),
        narrative_status:  'failed',
        narrative_digest:  nil, # never "ready" for these inputs, so a retry actually retries
        generation_error:  error.class.name
      )
      report
    end

    def request_narratives(result)
      response = gemini_client.generate_content(build_prompt(result), temperature: 0.3)
      data     = response.is_a?(Hash) ? response : JSON.parse(response.to_s)
      culture  = clean_text(data['culture_narrative'])
      overall  = clean_text(data['overall_narrative'])
      raise ArgumentError, 'empty narrative' if culture.nil? && overall.nil?

      { culture: culture, overall: overall }
    end

    def clean_text(value)
      return nil unless value.is_a?(String)

      text = value.strip
      text.empty? ? nil : text.truncate(MAX_NARRATIVE_CHARS)
    end

    def gemini_client
      @gemini_client ||= Gemini::HttpClient.new(
        model:   ENV.fetch('GEMINI_FLASH_MODEL', 'gemini-2.0-flash-001'),
        timeout: 30
      )
    end

    def language
      @portfolio.session&.assessment&.language.presence || 'en'
    end

    def language_name
      Assessment::SUPPORTED_LANGUAGES.fetch(language, 'English')
    end

    def describe(comparisons, result_key)
      comparisons.select { |c| c[:result] == result_key }.map do |c|
        base = "#{c[:skill_label]} (candidate L#{c[:candidate_level]} vs required L#{c[:required_level]}"
        base += ', LOW EVIDENCE - treat as uncertain' if c[:low_evidence]
        "#{base}#{c[:is_override] ? ', adjusted by a human assessor' : ''})"
      end
    end

    def build_prompt(result)
      cmp = result[:comparisons]
      sum = result[:summary]
      culture = @vacancy.culture_dimensions.to_s.truncate(1_500)
      competency = @vacancy.competency_expectations.to_s.truncate(1_500)

      <<~PROMPT
        You summarise a skills-assessment fit/gap comparison for a human hiring team.
        Use ONLY the facts below. Do not invent skills, experience or personal traits.
        Do NOT recommend hiring or rejecting. The decision belongs to people.
        Skills marked LOW EVIDENCE were only lightly probed: describe them as "needs verification", never as a confirmed weakness.
        Skills not assessed are unknown, not failures.
        Write in #{language_name}.

        ROLE: #{@vacancy.role_title}
        #{culture.present? ? "CULTURE EXPECTATIONS:\n#{culture}\n" : ''}
        #{competency.present? ? "COMPETENCY EXPECTATIONS:\n#{competency}\n" : ''}
        COVERAGE: #{sum[:assessed]} of #{sum[:total]} required skills assessed (#{sum[:coverage_pct]}%).
        - Matches: #{describe(cmp, 'match').join('; ').presence || 'none'}
        - Exceeds: #{describe(cmp, 'exceed').join('; ').presence || 'none'}
        - Gaps: #{describe(cmp, 'gap').join('; ').presence || 'none'}
        - Not assessed: #{cmp.select { |c| c[:result] == 'not_assessed' }.map { |c| c[:skill_label] }.join(', ').presence || 'none'}

        Write two short paragraphs:
        1. culture_narrative: 2-3 sentences on how the skill pattern relates to the culture and competency expectations. If none were given, say so in one sentence.
        2. overall_narrative: 2-3 sentences summarising strengths, the gaps worth a follow-up, and what was not assessed.

        OUTPUT (JSON only):
        { "culture_narrative": "...", "overall_narrative": "..." }
      PROMPT
    end

    def fallback_narrative(summary)
      return 'This vacancy lists no required skills, so there is nothing to compare.' if summary[:total].zero?

      "Automatic summary unavailable. Of #{summary[:total]} required skills: #{summary[:match]} match, " \
        "#{summary[:exceed]} exceed, #{summary[:gap]} fall short and #{summary[:not_assessed]} were not assessed."
    end
  end
end
