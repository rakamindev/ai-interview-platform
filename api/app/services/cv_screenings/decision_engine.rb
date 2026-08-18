# frozen_string_literal: true

module CvScreenings
  # Orchestrates one entry through the full pipeline: extract -> detect email ->
  # Layer 1 (public gate) -> Layer 2 (private score) -> threshold compare. Layer 2
  # never runs if Layer 1 didn't pass. Any failure along the way lands the entry
  # in needs_review with the matching reason — only a genuine Layer-1 :failed
  # verdict (a real model answer, not an error) can produce not_advanced. See the
  # plan doc's invariant: no system failure may ever produce an automated
  # rejection.
  class DecisionEngine
    def initialize(entry:, gemini_client: nil)
      @entry = entry
      @gemini_client = gemini_client
    end

    def call
      extraction = TextExtractor.new(@entry.cv_file).call

      case extraction.status
      when :parse_failed then return finish('needs_review', 'parse_failed', extraction.char_count)
      when :empty_text   then return finish('needs_review', 'empty_text', extraction.char_count)
      end

      email_result = EmailDetector.new(extraction.text).call
      return finish('needs_review', 'no_email_detected', extraction.char_count) if email_result.email.nil?

      @entry.update!(detected_email: email_result.email)

      vacancy_version = @entry.cv_screening_batch.vacancy_version
      gate = PublicGateChecker.new(
        public_requirement_text: vacancy_version.public_requirement_text,
        cv_text:                 extraction.text,
        gemini_client:            @gemini_client
      ).call

      return finish('needs_review', 'model_failed', extraction.char_count) if gate.model_failed?

      if gate.failed?
        feedback = FeedbackGenerator.new(
          public_requirement_text: vacancy_version.public_requirement_text,
          gemini_client:            @gemini_client
        ).call
        @entry.update!(feedback_text: feedback)
        return finish('not_advanced', 'failed_public_gate', extraction.char_count)
      end

      match = Matcher.new(
        vacancy_version: vacancy_version,
        cv_text:         extraction.text,
        gemini_client:    @gemini_client
      ).call

      return finish('needs_review', 'model_failed', extraction.char_count) unless match.ok?

      threshold = @entry.cv_screening_batch.threshold

      if threshold.present? && match.score >= threshold
        Inviter.new(entry: @entry).call
        finish('invited', 'auto_invited', extraction.char_count)
      else
        finish('needs_review', 'below_private_threshold', extraction.char_count)
      end
    end

    private

    def finish(decision, reason, char_count)
      @entry.update!(decision: decision, decision_reason: reason)
      Rails.logger.info(
        "[CvScreenings::DecisionEngine] entry_id=#{@entry.id} status=#{decision} " \
        "reason=#{reason} char_count=#{char_count}"
      )
      @entry
    end
  end
end
