# frozen_string_literal: true

module CvScreenings
  # Generates candidate-facing rejection feedback. Receives ONLY the vacancy's
  # public requirement text — no threshold, no score, no private criteria are
  # even passed into this class, so there is no code path by which they could
  # leak into a candidate email, regardless of how the prompt is worded. Used by
  # both the Layer-1 auto-reject path (DecisionEngine) and a recruiter's manual
  # reject (CvScreeningEntriesController#review) — same service, same wall,
  # regardless of trigger. Never raises: LLM failure falls back to generic,
  # still-true copy rather than blocking the reject action.
  class FeedbackGenerator
    def initialize(public_requirement_text:, gemini_client: nil)
      @public_requirement_text = public_requirement_text
      @gemini_client = gemini_client || Gemini::HttpClient.new(
        model: ENV.fetch('GEMINI_FLASH_MODEL', 'gemini-2.0-flash-001'), timeout: 30
      )
    end

    def call
      response = @gemini_client.generate_content(prompt, temperature: 0.5)
      data = response.is_a?(Hash) ? response : JSON.parse(response)
      data['feedback'].presence || fallback_feedback
    rescue StandardError => e
      Rails.logger.error("[CvScreenings::FeedbackGenerator] model call failed: #{e.class}")
      fallback_feedback
    end

    private

    def prompt
      <<~PROMPT
        Write brief, constructive, encouraging feedback for a candidate who was not
        selected to move forward in a hiring process. Do NOT mention any score,
        percentage, ranking, or threshold. Base your feedback only on the public
        role requirements below — do not invent or imply any other criteria.

        PUBLIC ROLE REQUIREMENTS:
        #{@public_requirement_text}

        Write 2-3 warm, professional sentences suitable to send directly to the
        candidate.

        OUTPUT (JSON only):
        {
          "feedback": "..."
        }
      PROMPT
    end

    def fallback_feedback
      'Thank you for your interest in this role. After careful review, we have ' \
        'decided to move forward with other candidates whose experience more ' \
        'closely matches our current requirements. We encourage you to apply for ' \
        'future openings that align with your background.'
    end
  end
end
