# frozen_string_literal: true

module Sessions
  # Activates a pending session and initializes coverage map rows from assessment skills.
  # Called when a candidate connects to the audio WebSocket and begins the interview.
  class StartHandler
    class InvalidAssessment < StandardError; end

    INVALID_REASONS = { duplicate_skill_labels: 'duplicate skills' }.freeze

    def initialize(session)
      @session = session
    end

    def call
      ensure_valid_assessment!

      ActiveRecord::Base.transaction do
        @session.update!(status: 'active', started_at: Time.current,
                         failure_code: nil, failure_detail: nil, failed_at: nil)
        initialize_coverage_maps
      end

      SessionDeadlineWorker.schedule_for(@session)
      publish_status_update
      Rails.logger.info("[N5/StartHandler] Session #{@session.id} activated")
      @session
    end

    private

    def ensure_valid_assessment!
      assessment = @session.assessment
      return if assessment.valid?

      Rails.logger.warn("[StartHandler] Assessment #{assessment.id} is invalid: " \
                        "#{assessment.errors.full_messages.to_sentence}")
      raise InvalidAssessment, invalid_reason(assessment)
    end

    def invalid_reason(assessment)
      error_types = assessment.errors.details.values.flatten.pluck(:error)
      INVALID_REASONS.values_at(*error_types).compact.first || 'invalid configuration'
    end

    def publish_status_update
      redis = ::Redis.new(url: ENV.fetch('REDIS_URL', 'redis://localhost:6379/1'))
      redis.publish("coverage:#{@session.id}", { type: 'session_status', status: @session.status, end_reason: nil }.to_json)
    rescue => e
      Rails.logger.error("[StartHandler] Failed to publish status update: #{e.message}")
    ensure
      redis&.close
    end

    def initialize_coverage_maps
      # Only initialize if no coverage maps exist yet (idempotent)
      return if @session.coverage_maps.exists?

      skills = @session.assessment.assessment_skills.order(:display_order)

      skills.each do |skill|
        @session.coverage_maps.create!(
          skill_id:      skill.skill_id,
          skill_label:   skill.skill_label,
          is_discovered: false,
          state:         'not_yet',
          probe_count:   0
        )
      end

      Rails.logger.info("[N5/StartHandler] Initialized #{skills.count} coverage map entries for session #{@session.id}")
    end
  end
end
