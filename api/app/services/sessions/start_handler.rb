
# frozen_string_literal: true

module Sessions
  # Activates a pending session and initializes coverage map rows from assessment skills.
  # Called when a candidate connects to the audio WebSocket and begins the interview.
  class StartHandler
    class InvitationExpiredError < StandardError; end
    class SessionNotStartableError < StandardError; end

    def initialize(session)
      @session = session
    end

    def call
      newly_activated = false

      ActiveRecord::Base.transaction do
        @session.lock!

        if @session.active?
          next
        end

        unless @session.pending?
          raise SessionNotStartableError,
                'This interview session cannot be started'
        end

        if @session.invitation_expired?
          raise InvitationExpiredError,
                'This interview invitation has expired'
        end

        @session.update!(
          status: 'active',
          started_at: Time.current
        )

        initialize_coverage_maps
        newly_activated = true
      end

      if newly_activated
        publish_status_update

        Rails.logger.info(
          "[N5/StartHandler] Session #{@session.id} activated"
        )
      end

      @session
    end

    private

    def publish_status_update
      redis = ::Redis.new(
        url: ENV.fetch(
          'REDIS_URL',
          'redis://localhost:6379/1'
        )
      )

      redis.publish(
        "coverage:#{@session.id}",
        {
          type: 'session_status',
          status: @session.status,
          end_reason: nil
        }.to_json
      )
    rescue => e
      Rails.logger.error(
        "[StartHandler] Failed to publish status update: #{e.message}"
      )
    ensure
      redis&.close
    end

    def initialize_coverage_maps
      # Only initialize if no coverage maps exist yet (idempotent)
      return if @session.coverage_maps.exists?

      skills = @session.assessment
        .assessment_skills
        .order(:display_order)

      skills.each do |skill|
        @session.coverage_maps.create!(
          skill_id: skill.skill_id,
          skill_label: skill.skill_label,
          is_discovered: false,
          state: 'not_yet',
          probe_count: 0
        )
      end

      Rails.logger.info(
        "[N5/StartHandler] Initialized #{skills.count} coverage map entries for session #{@session.id}"
      )
    end
  end
end
