# frozen_string_literal: true

class HealthController < ActionController::API
  def show
    checks = { database: database_healthy?, redis: redis_healthy? }
    healthy = checks.values.all?
    render json: { status: healthy ? 'ok' : 'degraded', checks: checks }, status: healthy ? :ok : :service_unavailable
  end

  private

  def database_healthy?
    ActiveRecord::Base.connection.select_value('SELECT 1').to_i == 1
  rescue StandardError => e
    Rails.logger.warn("[Health] Database check failed: #{e.class}: #{e.message}")
    false
  end

  def redis_healthy?
    redis = Redis.new(url: ENV.fetch('REDIS_URL', 'redis://localhost:6379/1'))
    redis.ping == 'PONG'
  rescue StandardError => e
    Rails.logger.warn("[Health] Redis check failed: #{e.class}: #{e.message}")
    false
  ensure
    redis&.close
  end
end
