# frozen_string_literal: true

module CvScreenings
  # Layer 1 — a coarse, defensible pass/fail check against ONLY the vacancy's
  # public requirement text (never the private skills/culture/competency fields).
  # This is the only layer allowed to produce an automated rejection at all.
  class PublicGateChecker
    # status: :passed | :failed | :model_failed
    # :failed means the model gave a real verdict of "does not meet requirements."
    # :model_failed means the call itself broke or returned something unusable —
    # this must NEVER be treated as a rejection signal.
    Result = Data.define(:status) do
      def passed? = status == :passed
      def failed? = status == :failed
      def model_failed? = status == :model_failed
    end

    def initialize(public_requirement_text:, cv_text:, gemini_client: nil)
      @public_requirement_text = public_requirement_text
      @cv_text = cv_text
      @gemini_client = gemini_client || Gemini::HttpClient.new(
        model: ENV.fetch('GEMINI_FLASH_MODEL', 'gemini-2.0-flash-001'), timeout: 30
      )
    end

    def call
      response = @gemini_client.generate_content(prompt, temperature: 0.0)
      data = response.is_a?(Hash) ? response : JSON.parse(response)

      case data['passes']
      when true  then Result.new(status: :passed)
      when false then Result.new(status: :failed)
      else            Result.new(status: :model_failed)
      end
    rescue StandardError => e
      Rails.logger.error("[CvScreenings::PublicGateChecker] model call failed: #{e.class}")
      Result.new(status: :model_failed)
    end

    private

    def prompt
      <<~PROMPT
        You are screening a candidate CV against the PUBLIC requirements of a job
        posting. Only use the requirements listed below — do not infer or apply any
        other criteria. Be lenient: only fail candidates who obviously and
        unambiguously do not meet what's stated.

        PUBLIC REQUIREMENTS:
        #{@public_requirement_text}

        CANDIDATE CV TEXT:
        #{@cv_text}

        OUTPUT (JSON only):
        {
          "passes": true or false,
          "reasoning": "one sentence, for internal use only"
        }
      PROMPT
    end
  end
end
