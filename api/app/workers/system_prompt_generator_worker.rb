# frozen_string_literal: true

class SystemPromptGeneratorWorker
  include Sidekiq::Worker

  sidekiq_options queue: :default, retry: 3

  # Terminal state for a job that ran out of retries — logged at error level
  # (id and count only, never the raw message) so it is visible, not silent.
  sidekiq_retries_exhausted do |msg, _ex|
    Rails.logger.error("[N2] System prompt generation permanently failed for assessment=#{msg['args'].first} after #{msg['retry_count']} retries")
  end

  def perform(assessment_id)
    assessment = Assessment.find(assessment_id)
    prompt = Assessments::SystemPromptCompiler.new(assessment).call
    assessment.update!(system_prompt: prompt)
    Rails.logger.info("[N2] System prompt generated for assessment #{assessment_id}")
  rescue ActiveRecord::RecordNotFound
    Rails.logger.warn("[N2] Assessment #{assessment_id} not found — skipping")
  rescue StandardError => e
    Rails.logger.error("[N2] SystemPromptGeneratorWorker failed for assessment=#{assessment_id}: #{e.class}: #{e.message}")
    raise
  end
end
