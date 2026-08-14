# frozen_string_literal: true

class JsonWebToken
  TOKEN_EXPIRATION_TIME = ENV['TOKEN_EXPIRATION_TIME'].presence
  ISSUER   = 'ai-interview-api'
  AUDIENCE = 'ai-interview-web'

  def self.encode(payload, expire_time = nil)
    payload = payload.dup

    if payload[:exp].blank?
      expire_time ||= TOKEN_EXPIRATION_TIME || 3.days
      payload[:exp] = Time.zone.now.to_i + expire_time.to_i
    end

    payload[:iss] = ISSUER
    payload[:aud] = AUDIENCE

    JWT.encode(payload, hmac_secret, 'HS256')
  end

  def self.decode(token, options = {})
    verify_options = options.merge(
      algorithms: ['HS256'],
      iss:        ISSUER,
      aud:        AUDIENCE,
      verify_iss: true,
      verify_aud: true
    )

    body = JWT.decode(token, hmac_secret, true, verify_options)[0]
    HashWithIndifferentAccess.new(body)
  rescue JWT::DecodeError => e
    raise ExceptionHandler::InvalidToken, e.message
  end

  def self.hmac_secret
    ENV['JWT_SECRET_KEY'].presence || ENV.fetch('SECRET_KEY_BASE')
  end
  private_class_method :hmac_secret
end
