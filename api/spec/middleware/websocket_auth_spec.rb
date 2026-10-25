# frozen_string_literal: true

require 'rails_helper'

# F-02 fix: shared WebSocket authz (WebSocketAuth) now enforces the SAME role
# policy as REST (via AuthorizeApiRequest). Tests exercise the concern directly
# through an anonymous middleware, matching how AudioWebSocketMiddleware and
# CoverageWebSocketMiddleware include it.
RSpec.describe WebSocketAuth do
  let(:middleware) { Class.new { include WebSocketAuth }.new }

  let(:org_alpha) do
    Organization.create!(
      name: 'Alpha Corp',
      scheme: 'alpha-test',
      identifier: 'alpha-test',
      host: 'alpha.test.local'
    )
  end

  let(:org_beta) do
    Organization.create!(
      name: 'Beta Corp',
      scheme: 'beta-test',
      identifier: 'beta-test',
      host: 'beta.test.local'
    )
  end

  def create_session(org, status: 'active')
    Current.using(tenant_id: org.id) do
      assessment = Assessment.create!(
        name: 'F02 Assessment',
        tenant_id: org.id,
        created_by: 1,
        time_limit_min: 30
      )
      Session.create!(
        assessment_id: assessment.id,
        tenant_id: org.id,
        candidate_id: 'cand-f02',
        candidate_name: 'Candidate F02',
        status: status
      )
    end
  end

  let(:session_alpha) { create_session(org_alpha) }
  let(:session_beta)  { create_session(org_beta) }

  def jwt(role, scheme)
    JsonWebToken.encode({ user_id: 1, role: role, scheme: scheme })
  end

  def env_for(auth_header)
    Rack::MockRequest.env_for(
      '/ws/sessions/1/audio',
      'HTTP_AUTHORIZATION' => auth_header
    )
  end

  describe 'assessor JWT path (REST-consistent role check)' do
    context 'assessor from owning tenant' do
      it 'accepts admin role' do
        session, error = middleware.authenticate_websocket(
          env_for("Bearer #{jwt('admin', org_alpha.scheme)}"), session_alpha.id.to_s
        )
        expect(error).to be_nil
        expect(session.id).to eq(session_alpha.id)
      end

      it 'accepts assessor role (own session)' do
        session, error = middleware.authenticate_websocket(
          env_for("Bearer #{jwt('assessor', org_alpha.scheme)}"), session_alpha.id.to_s
        )
        expect(error).to be_nil
        expect(session.id).to eq(session_alpha.id)
      end
    end

    context 'role user (non-assessor) — the F-02 vulnerability' do
      it 'rejects role user from the same tenant' do
        _session, error = middleware.authenticate_websocket(
          env_for("Bearer #{jwt('user', org_alpha.scheme)}"), session_alpha.id.to_s
        )
        expect(error).to eq('Assessor role required')
      end
    end

    context 'missing/invalid credentials' do
      it 'rejects missing Authorization header' do
        _session, error = middleware.authenticate_websocket(
          Rack::MockRequest.env_for('/ws/sessions/1/audio'), session_alpha.id.to_s
        )
        expect(error).to eq('Missing authorization')
      end

      it 'rejects expired/invalid JWT' do
        bad = JWT.encode({ user_id: 1, role: 'assessor' }, 'wrong-secret', 'HS256')
        _session, error = middleware.authenticate_websocket(
          env_for("Bearer #{bad}"), session_alpha.id.to_s
        )
        expect(error).to be_present
      end
    end

    context 'tenant ownership (anti-IDOR across tenants)' do
      it "rejects assessor from tenant Beta connecting to tenant Alpha's session" do
        _session, error = middleware.authenticate_websocket(
          env_for("Bearer #{jwt('assessor', org_beta.scheme)}"), session_alpha.id.to_s
        )
        expect(error).to eq('Session not found')
      end
    end

    context 'path/numeric session id integrity' do
      it 'rejects when loaded session id does not match path id' do
        _session, error = middleware.authenticate_websocket(
          env_for("Bearer #{jwt('assessor', org_alpha.scheme)}"), '999999'
        )
        expect(error).to eq('Session not found')
      end
    end
  end

  describe 'candidate invite-token path' do
    context 'active session' do
      it 'accepts a valid invite token on an ACTIVE session' do
        session, error = middleware.authenticate_websocket(
          Rack::MockRequest.env_for("/ws/sessions/#{session_alpha.id}/audio?token=#{session_alpha.invite_token}"),
          session_alpha.id.to_s
        )
        expect(error).to be_nil
        expect(session.id).to eq(session_alpha.id)
      end
    end

    context 'non-terminal session (connectable — activated on first connect)' do
      it 'accepts a PENDING session via invite token (activated by StartHandler on connect)' do
        pending = create_session(org_alpha, status: 'pending')
        session, error = middleware.authenticate_websocket(
          Rack::MockRequest.env_for("/ws/sessions/#{pending.id}/audio?token=#{pending.invite_token}"),
          pending.id.to_s
        )
        expect(error).to be_nil
        expect(session.id).to eq(pending.id)
      end

      it 'rejects an ENDED session via invite token' do
        ended = create_session(org_alpha, status: 'ended')
        _session, error = middleware.authenticate_websocket(
          Rack::MockRequest.env_for("/ws/sessions/#{ended.id}/audio?token=#{ended.invite_token}"),
          ended.id.to_s
        )
        expect(error).to eq('Session has ended')
      end

      it 'rejects a FAILED session via invite token (terminal — no audio injection)' do
        failed = create_session(org_alpha, status: 'failed')
        _session, error = middleware.authenticate_websocket(
          Rack::MockRequest.env_for("/ws/sessions/#{failed.id}/audio?token=#{failed.invite_token}"),
          failed.id.to_s
        )
        expect(error).to eq('Session has ended')
      end
    end
  end
end
