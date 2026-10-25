# frozen_string_literal: true

# Shared WebSocket authorization for all /ws/* middlewares that proxy a live
# session (audio + coverage) between browser and AI.
#
# SINGLE SOURCE OF TRUTH FOR REST + WS AUTHZ (Constraint Signal CS-2 / F-02):
# the assessor connector reuses `AuthorizeApiRequest` — the exact same class REST
# controllers invoke via the `authorize_auth_token! :assessor` macro. Because the
# role policy lives in one class, REST and WS can never diverge again.
#
# Two connector identities, matching the product:
#   1. Assessor  ->  Authorization: Bearer <JWT>  (requires admin/assessor role + tenant ownership)
#   2. Candidate ->  ?token=<invite_token>        (credential is the invite token; session must be active)
#
# Both connectors still enforce: session exists, session not ended, path session_id
# matches the loaded session (anti-IDOR on the numeric id), and (candidate) active.
module WebSocketAuth
  AUTHORIZATION_HEADER = 'HTTP_AUTHORIZATION'

  # Public entry for middlewares that accept both connectors (e.g. audio WS).
  # Auto-detects connector by the presence of an invite token query param.
  # Returns [session, nil] on success, [nil, message] on failure.
  def authenticate_websocket(env, session_id)
    request = Rack::Request.new(env)
    invite_token = request.params['token']

    if invite_token.present?
      authenticate_candidate(invite_token, session_id)
    else
      authenticate_assessor(env, session_id)
    end
  end

  # Assessor connector from an Authorization header (audio header path, coverage header path).
  def authenticate_assessor(env, session_id)
    auth_header = env[AUTHORIZATION_HEADER]
    return [nil, 'Missing authorization'] unless auth_header.present?

    authenticate_assessor_by_token(auth_header.split(' ').last, session_id)
  end

  # Assessor connector from a raw JWT (coverage message { type: "auth", token } path).
  # `AuthorizeApiRequest` does the JWT decode + role check — shared with REST.
  def authenticate_assessor_by_token(token, session_id)
    result = AuthorizeApiRequest.new({ 'Authorization' => "Bearer #{token}" }, [:assessor]).call
    user = result[:user]

    org = Organization.find_by(scheme: user.scheme)
    return [nil, 'Invalid tenant'] unless org

    session = Session.unscoped.where(tenant_id: org.id).find_by(id: session_id)
    return [nil, 'Session not found'] unless session
    return [nil, 'Session has ended'] if session.ended?
    return [nil, 'Session ID mismatch'] if session.id.to_s != session_id

    [session, nil]
  rescue ExceptionHandler::Unauthorized
    [nil, 'Assessor role required']
  rescue ExceptionHandler::MissingToken, ExceptionHandler::InvalidToken => e
    [nil, e.message]
  rescue StandardError => e
    [nil, "Authentication failed: #{e.message}"]
  end

  # Candidate connector: the invite token IS the credential. A PENDING session is
  # connectable — the audio WS activates it on first connect (StartHandler), which
  # is the product's only activation path (assessor creates → candidate starts).
  # Only TERMINAL sessions (ended/failed) must not accept live audio injection:
  # a leaked token must not corrupt a completed/failed session's transcript.
  def authenticate_candidate(invite_token, session_id)
    session = Session.unscoped.find_by(invite_token: invite_token)
    return [nil, 'Session not found'] unless session
    return [nil, 'Session has ended'] if session.status.in?(%w[ended failed])
    return [nil, 'Session ID mismatch'] if session.id.to_s != session_id

    [session, nil]
  rescue StandardError => e
    [nil, "Authentication failed: #{e.message}"]
  end
end
