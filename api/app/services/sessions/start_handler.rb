# frozen_string_literal: true

module Sessions
  # Activates a pending session and initializes coverage map rows from assessment skills.
  # Called when a candidate connects to the audio WebSocket and begins the interview.
  class StartHandler
    def initialize(session)
      @session = session
    end

    def call
      ActiveRecord::Base.transaction do
        @session.update!(status: 'active', started_at: Time.current)
        initialize_coverage_maps
      end

      schedule_time_ceiling
      publish_status_update
      Rails.logger.info("[N5/StartHandler] Session #{@session.id} activated")
      @session
    end

    private

    # Watchdog: the WebSocket ceiling check only runs on transcription events,
    # so a silent candidate would never hit the advertised limit. The +60s
    # grace matches the WebSocket wrap-up path.
    def schedule_time_ceiling
      return unless @session.assessment.time_limit_min

      SessionTimeCeilingWorker.perform_in(@session.assessment.time_limit_min * 60 + 60, @session.id)
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
