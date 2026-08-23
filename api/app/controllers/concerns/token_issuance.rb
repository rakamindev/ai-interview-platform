# frozen_string_literal: true

# Shared refresh-token / CSRF-cookie issuance logic, extracted from
# AuthenticationController so InvitesController (accept_invite) can log a
# newly-created user in the same way login/refresh do, without duplicating
# the cookie/CSRF mechanics.
module TokenIssuance
  extend ActiveSupport::Concern

  private

  # Mints an access token + rotating refresh cookie + CSRF cookie for `user`,
  # returning the same response shape as POST /auth/login.
  def issue_session_for(user, scheme:)
    token = JsonWebToken.encode({ user_id: user.id, role: user.role, scheme: scheme })

    refresh_token = SecureRandom.hex(32)
    RefreshToken.create!(
      user_id: user.id,
      token_hash: token_hash(refresh_token),
      expires_at: 7.days.from_now
    )
    store_refresh_cookie(refresh_token)
    store_csrf_cookie

    effective_role = Membership.effective_role(user_id: user.id, scheme: scheme, fallback_role: user.role)
    { access_token: token, user: { id: user.id, email: user.email, role: effective_role }, refresh: true }
  end

  def store_refresh_cookie(token)
    cookies[:refresh_token] = {
      value: token,
      path: "/api/v1/auth",
      max_age: 604_800,
      same_site: :lax,
      httponly: true,
      secure: Rails.env.production?
    }
  end

  def clear_refresh_cookie
    cookies.delete(:refresh_token, path: "/api/v1/auth")
  end

  def extract_refresh_token
    cookies[:refresh_token]
  end

  def store_csrf_cookie
    secret = csrf_signing_key
    data = csrf_session_data
    token = OpenSSL::HMAC.hexdigest("SHA256", secret, data)
    cookies[:csrf_secret] = {
      value: token,
      expires: 7.days.from_now,
      secure: Rails.env.production?,
      same_site: :lax,
      httponly: false
    }
    @csrf_secret = token
  end

  def verify_csrf!
    stored = cookies[:csrf_secret]
    header = request.headers["X-CSRF-Token"]
    return if stored.present? && header.present? && ActiveSupport::SecurityUtils.secure_compare(stored, header)

    raise(ExceptionHandler::InvalidToken, "CSRF token mismatch")
  end

  def csrf_session_data
    rt = extract_refresh_token
    rt_hash = rt ? token_hash(rt) : "anonymous"
    user_id = extract_refresh_token_user_id || "none"
    "#{user_id}:#{rt_hash}"
  end

  def csrf_signing_key
    Rails.application.credentials.csrf_secret_key || ENV.fetch("CSRF_SECRET_KEY") { SecureRandom.hex(32) }
  end

  def extract_refresh_token_user_id
    rt = extract_refresh_token
    return nil unless rt

    record = RefreshToken.find_by(token_hash: token_hash(rt))
    record&.user_id&.to_s
  end

  def token_hash(token)
    RefreshToken.hash_token(token)
  end

  def issue_refresh_token(user_id)
    new_token = SecureRandom.hex(32)
    RefreshToken.create!(
      user_id: user_id,
      token_hash: token_hash(new_token),
      expires_at: 7.days.from_now
    )
    new_token
  end

  def resolve_scheme
    scheme_from_referer || Organization.order(:created_at).limit(1).pick(:scheme) || "test-corp"
  end

  def scheme_from_referer
    referer = request.referer.to_s
    return if referer.blank?

    host = URI.parse(referer).host.to_s
    return if host.blank?

    Organization.find_by(host: host)&.scheme
  rescue URI::InvalidURIError
    nil
  end
end
