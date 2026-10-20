# frozen_string_literal: true

require 'rails_helper'

# The consent screen alone would be decoration: the invite token sits in the
# URL, so anyone can open this socket directly and skip the browser entirely.
# These specs exercise `handle_browser_open`, the same method the socket runs,
# because asserting on a helper the socket does not use would prove nothing.
RSpec.describe AudioWebSocketMiddleware do
  subject(:middleware) { described_class.new(->(_env) { [200, {}, []] }) }

  let(:organization) { create(:organization) }
  let(:session)      { create(:session, tenant_id: organization.id) }
  let(:state)        { described_class::ConnectionState.new }
  let(:sent)         { [] }

  let(:socket) do
    instance_double(Faye::WebSocket).tap do |ws|
      allow(ws).to receive(:send) { |payload| sent << payload }
      allow(ws).to receive(:close)
    end
  end

  let(:env) do
    {
      "REQUEST_METHOD" => "GET",
      "PATH_INFO"      => "/ws/sessions/#{session.id}/audio",
      "QUERY_STRING"   => "token=#{session.invite_token}",
      "rack.input"     => StringIO.new("")
    }
  end

  before do
    # Stubbed so the granted path cannot reach out to Gemini. If the gate is
    # ever removed, the only thing that changes is this expectation.
    allow(middleware).to receive(:connect_to_gemini)
  end

  describe 'candidate consent gate' do
    it 'refuses the socket before any audio can flow when consent is missing' do
      middleware.send(:handle_browser_open, env, session.id.to_s, socket, state)

      payload = JSON.parse(sent.last)
      expect(payload['code']).to eq('consent_required')
      expect(payload['recoverable']).to be false
      expect(socket).to have_received(:close)
      expect(middleware).not_to have_received(:connect_to_gemini)
      expect(state.session).to be_nil
    end

    it 'carries a message the candidate can act on, not a stack trace' do
      middleware.send(:handle_browser_open, env, session.id.to_s, socket, state)

      message = JSON.parse(sent.last)['message']
      expect(message).to match(/consent/i)
      expect(message).not_to match(%r{app/|gems/|http})
    end

    it 'lets the socket through once consent is recorded' do
      create(:consent, session: session)

      middleware.send(:handle_browser_open, env, session.id.to_s, socket, state)

      expect(middleware).to have_received(:connect_to_gemini)
      expect(state.session).to eq(session)
      expect(sent).to be_empty
      expect(socket).not_to have_received(:close)
    end

    it 'treats consent given against older wording as missing' do
      create(:consent, :stale, session: session)

      middleware.send(:handle_browser_open, env, session.id.to_s, socket, state)

      expect(JSON.parse(sent.last)['code']).to eq('consent_required')
      expect(middleware).not_to have_received(:connect_to_gemini)
    end

    it 'does not gate staff connections, which cannot carry candidate audio' do
      staff_env = env.merge(
        "QUERY_STRING"     => "",
        "HTTP_AUTHORIZATION" => "Bearer #{JsonWebToken.encode(user_id: 1, role: 'admin', scheme: organization.scheme)}"
      )

      middleware.send(:handle_browser_open, staff_env, session.id.to_s, socket, state)

      expect(middleware).to have_received(:connect_to_gemini)
      expect(sent).to be_empty
    end

    it 'still refuses a staff connection when the session has ended' do
      ended = create(:session, :ended, tenant_id: organization.id)
      staff_env = env.merge(
        "PATH_INFO"        => "/ws/sessions/#{ended.id}/audio",
        "QUERY_STRING"     => "",
        "HTTP_AUTHORIZATION" => "Bearer #{JsonWebToken.encode(user_id: 1, role: 'admin', scheme: organization.scheme)}"
      )

      middleware.send(:handle_browser_open, staff_env, ended.id.to_s, socket, state)

      expect(JSON.parse(sent.last)['code']).to eq('auth_failed')
      expect(middleware).not_to have_received(:connect_to_gemini)
    end
  end
end
