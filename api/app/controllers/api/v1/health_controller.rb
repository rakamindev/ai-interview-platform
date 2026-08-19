# frozen_string_literal: true

module Api
  module V1
    # Deep readiness probe: verifies the dependencies the app actually needs
    # (PostgreSQL + Redis) and returns 503 when either is unavailable, so the
    # k8s readiness probe can shed traffic without restarting the container.
    # Liveness stays on the static /health route (see config/routes.rb).
    class HealthController < ApiController
      # k8s probes carry no JWT — readiness must not require a tenant.
      def require_tenant!; end

      def ready
        ActiveRecord::Base.connection.execute('SELECT 1')
        Sidekiq.redis(&:ping)
        render json: { status: 'ready' }
      rescue StandardError => e
        render json: { status: 'unavailable', error: e.class.name }, status: :service_unavailable
      end
    end
  end
end
