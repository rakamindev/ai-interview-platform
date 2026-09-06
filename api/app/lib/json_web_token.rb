# frozen_string_literal: true

# Identical to rakamin-api's JsonWebToken.
# Uses the same SECRET_KEY_BASE so tokens issued by rakamin are accepted here.
class JsonWebToken
  TOKEN_EXPIRATION_TIME = ENV['TOKEN_EXPIRATION_TIME'].presence

  def self.encode(payload, expire_time = nil)
    if payload[:exp].blank?
      expire_time ||= TOKEN_EXPIRATION_TIME || 3.days
      payload[:exp] = Time.zone.now.to_i + expire_time.to_i
    end

    JWT.encode(payload, hmac_secret, 'HS256')
  end

  def self.decode(token, options = {})
    raise ExceptionHandler::InvalidToken, 'Token has been revoked' if revoked?(token)

    decode_options = { verify_expiration: true, algorithms: ['HS256'] }.merge(options)
    body = JWT.decode(token, hmac_secret, true, decode_options)[0]
    HashWithIndifferentAccess.new(body)
  rescue JWT::ExpiredSignature => e
    raise ExceptionHandler::InvalidToken, "Signature has expired: #{e.message}"
  rescue JWT::DecodeError => e
    raise ExceptionHandler::InvalidToken, e.message
  end

  def self.revoked?(token)
    return false if token.blank?

    if defined?(Sidekiq) && Sidekiq.respond_to?(:redis)
      Sidekiq.redis do |conn|
        conn.exists?("revoked_token:#{Digest::SHA256.hexdigest(token)}") == 1
      end
    else
      false
    end
  rescue StandardError
    false
  end

  def self.revoke(token, expires_in = 3.days.to_i)
    return false if token.blank?

    if defined?(Sidekiq) && Sidekiq.respond_to?(:redis)
      Sidekiq.redis do |conn|
        conn.setex("revoked_token:#{Digest::SHA256.hexdigest(token)}", expires_in, '1')
      end
      true
    else
      false
    end
  rescue StandardError => e
    Rails.logger.warn("[JsonWebToken] Failed to revoke token in Redis: #{e.message}")
    false
  end

  def self.decode_without_verification(token)
    body = JWT.decode(token, nil, false)[0]
    HashWithIndifferentAccess.new(body)
  rescue JWT::DecodeError => e
    raise ExceptionHandler::InvalidToken, e.message
  end

  def self.hmac_secret
    ENV.fetch('SECRET_KEY_BASE')
  end
  private_class_method :hmac_secret
end
