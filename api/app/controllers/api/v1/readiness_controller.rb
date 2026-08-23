# frozen_string_literal: true

module Api
  module V1
    # Deep readiness check for the k8s readinessProbe: verifies the app can
    # actually serve interviews, not just that the process is up.
    # Liveness stays on the shallow /health so a dependency blip doesn't
    # restart an otherwise healthy pod.
    class ReadinessController < ActionController::API
      def show
        checks = {
          database:     database_up?,
          redis:        redis_up?,
          eventmachine: EventMachine.reactor_running?
        }

        healthy = checks.values.all?
        render json: { status: healthy ? 'ok' : 'degraded', checks: checks },
               status: healthy ? :ok : :service_unavailable
      end

      private

      def database_up?
        ActiveRecord::Base.connection.select_value('SELECT 1') == 1
      rescue StandardError
        false
      end

      def redis_up?
        Sidekiq.redis { |client| client.ping } == 'PONG'
      rescue StandardError
        false
      end
    end
  end
end
