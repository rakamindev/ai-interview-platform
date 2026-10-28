# frozen_string_literal: true

module FitGap
  # N13: writes the AI narrative for a fit/gap report. The skill comparison
  # itself is computed on read by FitGap::ReportPresenter; this class stores a
  # snapshot of the comparison the narrative was based on, the narrative, and
  # its status. A failed call is recorded as a failure with a safe code; no
  # template text is stored in its place (D-8).
  class Engine
    class EmptyOutput < StandardError; end
    class InvalidOutput < StandardError; end

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
      presenter = ReportPresenter.new(portfolio: @portfolio, vacancy: @vacancy, report: nil)
      report = FitGapReport.find_or_create_by!(portfolio_id: @portfolio.id, vacancy_id: @vacancy.id)

      narrative = generate_narrative(presenter)
      report.update!(skill_comparisons: presenter.comparisons, input_digest: presenter.input_digest,
                     status: 'complete', narrative_source: 'ai', error_code: nil,
                     culture_narrative: narrative['culture_narrative'],
                     overall_narrative: narrative['overall_narrative'],
                     generated_at: Time.current, completed_at: Time.current)

      Rails.logger.info("[N13] Fit/gap narrative generated: portfolio=#{@portfolio.id} vacancy=#{@vacancy.id}")
      report
    rescue StandardError => e
      fail_narrative(report, e)
    end

    private

    def generate_narrative(presenter)
      response = @gemini_client.generate_content(build_narrative_prompt(presenter), temperature: 0.4)
      raise EmptyOutput if response.nil? || (response.is_a?(String) && response.strip.empty?)

      data = response.is_a?(Hash) ? response : JSON.parse(response)
      raise InvalidOutput unless data.is_a?(Hash) && data['overall_narrative'].is_a?(String)

      data
    rescue JSON::ParserError
      raise InvalidOutput
    end

    def fail_narrative(report, error)
      code = case error
             when EmptyOutput then 'empty_output'
             when InvalidOutput then 'invalid_output'
             else Gemini::ErrorCode.for(error)
             end
      report&.update_columns(status: 'failed', error_code: code, narrative_source: nil,
                             culture_narrative: nil, overall_narrative: nil, completed_at: Time.current)
      Rails.logger.error("[N13] Fit/gap narrative failed: portfolio=#{@portfolio.id} vacancy=#{@vacancy.id} " \
                         "code=#{code} error=#{error.class.name}")
      raise error if report.nil?

      report
    end

    def build_narrative_prompt(presenter)
      groups = presenter.comparisons.group_by { |c| c[:result] }
      line = lambda do |result|
        Array(groups[result]).map do |c|
          level = c[:candidate_level] ? "L#{c[:candidate_level]}" : 'none'
          "#{c[:skill_label]} (required L#{c[:expected_level]}, candidate #{level})"
        end.join(', ')
      end

      <<~PROMPT
        You are writing a short fit/gap narrative to help a hiring team prepare their next conversation.
        It is not a hiring decision.

        ROLE: #{@vacancy.role_title}
        #{@vacancy.culture_dimensions.present? ? "CULTURE EXPECTATIONS:\n#{@vacancy.culture_dimensions}\n" : ''}
        #{@vacancy.competency_expectations.present? ? "COMPETENCY EXPECTATIONS:\n#{@vacancy.competency_expectations}\n" : ''}
        SKILL COMPARISON (only the first three groups were measured):
        - Matches: #{line.call('match')}
        - Gaps: #{line.call('gap')}
        - Exceeds: #{line.call('exceed')}
        - Not assessed (no evidence, do not treat as gaps): #{line.call('not_assessed')}
        - Low confidence (thin evidence, do not treat as gaps or strengths): #{line.call('low_confidence')}

        Write two short paragraphs:
        1. culture_narrative: 2-3 sentences on culture/competency fit from the measured skills only.
        2. overall_narrative: 2-3 sentences summarising what was measured and what must be probed next.

        OUTPUT (JSON only):
        {
          "culture_narrative": "...",
          "overall_narrative": "..."
        }
      PROMPT
    end
  end
end
