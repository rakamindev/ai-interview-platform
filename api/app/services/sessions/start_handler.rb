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

      publish_status_update
      Rails.logger.info("[N5/StartHandler] Session #{@session.id} activated")
      @session
    end

    private

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

      skills = session_skills

      skills.each do |skill|
        @session.coverage_maps.create!(
          skill_id:      skill[:skill_id],
          skill_label:   skill[:skill_label],
          is_discovered: false,
          state:         'not_yet',
          probe_count:   0
        )
      end

      Rails.logger.info("[N5/StartHandler] Initialized #{skills.count} coverage map entries for session #{@session.id}")
    end

    # Reads from the assessment version stamped at invite time (Sessions::Creator),
    # so editing the assessment after inviting a candidate cannot change what they're
    # interviewed on. Falls back to the assessment's live current skills only for
    # sessions created before Phase 2's version backfill (nullable assessment_version_id).
    def session_skills
      if @session.assessment_version
        @session.assessment_version.skills_snapshot.map(&:symbolize_keys)
      else
        @session.assessment.assessment_skills.order(:display_order).map do |skill|
          { skill_id: skill.skill_id, skill_label: skill.skill_label }
        end
      end
    end
  end
end
