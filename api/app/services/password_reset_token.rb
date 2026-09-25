# frozen_string_literal: true

require 'digest'

class PasswordResetToken
  PURPOSE = 'password-reset'
  DEFAULT_TTL = 30.minutes

  def self.generate(user, expires_in: DEFAULT_TTL)
    verifier.generate(
      {
        user_id: user.id,
        exp: expires_in.from_now.to_i,
        password_fingerprint: fingerprint(user)
      },
      purpose: PURPOSE
    )
  end

  def self.verify(token)
    payload = verifier.verified(token.to_s, purpose: PURPOSE)
    return if payload.blank?

    expires_at = payload[:exp] || payload['exp']
    user_id = payload[:user_id] || payload['user_id']
    expected_fingerprint = payload[:password_fingerprint] || payload['password_fingerprint']
    return if expires_at.to_i < Time.current.to_i

    user = User.find_by(id: user_id)
    return unless user
    return unless ActiveSupport::SecurityUtils.secure_compare(expected_fingerprint.to_s, fingerprint(user))

    user
  rescue ActiveSupport::MessageVerifier::InvalidSignature
    nil
  end

  def self.fingerprint(user)
    Digest::SHA256.hexdigest(user.password_digest.to_s)
  end
  private_class_method :fingerprint

  def self.verifier
    secret = ENV.fetch('SECRET_KEY_BASE')
    ActiveSupport::MessageVerifier.new(secret, digest: 'SHA256', serializer: JSON)
  end
  private_class_method :verifier
end
