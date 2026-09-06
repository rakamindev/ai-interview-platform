# frozen_string_literal: true

class SystemPromptGeneratorWorker
  include Sidekiq::Worker

  sidekiq_options queue: :default, retry: 3

  def perform(assessment_id)
    assessment = Assessment.find(assessment_id)
    assessment.update!(prompt_generation_status: 'generating')
    prompt = Assessments::SystemPromptCompiler.new(assessment).call
    assessment.update!(system_prompt: prompt, prompt_generation_status: 'complete', prompt_generation_error: nil)
    Rails.logger.info("[N2] System prompt generated for assessment #{assessment_id}")
  rescue ActiveRecord::RecordNotFound
    Rails.logger.warn("[N2] Assessment #{assessment_id} not found — skipping")
  rescue StandardError => e
    assessment&.update(prompt_generation_status: 'failed', prompt_generation_error: "#{e.class}: #{e.message}")
    Rails.logger.error("[N2] SystemPromptGeneratorWorker failed for assessment=#{assessment_id}: #{e.class}: #{e.message}")
    raise
  end
end
