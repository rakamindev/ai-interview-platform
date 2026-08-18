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
    body = JWT.decode(token, hmac_secret, true, options.merge(algorithms: ['HS256']))[0]
    HashWithIndifferentAccess.new(body)
  rescue JWT::DecodeError => e
    raise ExceptionHandler::InvalidToken, e.message
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
