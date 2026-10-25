# frozen_string_literal: true

require 'rails_helper'

RSpec.describe AudioWebSocketMiddleware do
  subject(:middleware) { described_class.new(->(_env) { [404, {}, []] }) }

  let(:browser_ws) do
    Class.new do
      attr_reader :messages, :closed

      def initialize
        @messages = []
      end

      def send(payload) = @messages << JSON.parse(payload)
      def close = @closed = true
    end.new
  end
  let(:turns) { instance_double(ActiveRecord::Associations::CollectionProxy, maximum: 3) }
  let(:session) do
    instance_double(Session, id: 42, transcript_turns: turns, status: 'active').tap do |record|
      allow(record).to receive(:reload).and_return(record)
      allow(record).to receive(:with_lock).and_yield
    end
  end
  let(:lease) { instance_double(Sessions::ConnectionLease) }

  describe 'initial ownership' do
    it 'does not create a Gemini connection while another owner is active' do
      state = described_class::ConnectionState.new
      in_use = Sessions::ConnectionLease::Result.new(
        status: :in_use,
        generation: 1,
        owner_connection_id: 'tab-a'
      )

      allow(middleware).to receive(:authenticate_and_load).and_return([session, nil])
      allow(Sessions::ConnectionLease).to receive(:new).with(session.id).and_return(lease)
      allow(lease).to receive(:acquire).and_return(in_use)
      expect(middleware).not_to receive(:connect_to_gemini)

      middleware.send(:handle_browser_open, {}, session.id.to_s, browser_ws, state)

      expect(browser_ws.messages.last).to include(
        'type' => 'session_in_use',
        'recoverable' => true
      )
      expect(state.waiting_for_takeover).to be(true)
      expect(state.gemini_client).to be_nil
    end

    it 'starts the Gemini lifecycle only after explicit takeover confirmation' do
      state = described_class::ConnectionState.new
      state.session = session
      state.lease = lease
      state.waiting_for_takeover = true
      taken_over = Sessions::ConnectionLease::Result.new(
        status: :taken_over,
        generation: 2,
        owner_connection_id: state.connection_id
      )

      allow(lease).to receive(:takeover).and_return(taken_over)
      expect(middleware).to receive(:activate_connection_owner).with(browser_ws, state, taken_over).once

      middleware.send(:handle_browser_message, { type: 'takeover' }.to_json, browser_ws, state)
    end

    it 'rejects takeover if the session became terminal while the second tab waited' do
      terminal_session = instance_double(
        Session,
        id: 42,
        status: 'ended',
        end_reason: 'error',
        reload: nil
      )
      allow(terminal_session).to receive(:reload).and_return(terminal_session)
      allow(terminal_session).to receive(:with_lock).and_yield
      state = described_class::ConnectionState.new
      state.session = terminal_session
      state.lease = lease
      state.waiting_for_takeover = true
      expect(lease).not_to receive(:takeover)
      expect(middleware).not_to receive(:connect_to_gemini)

      middleware.send(:handle_browser_message, { type: 'takeover' }.to_json, browser_ws, state)

      expect(browser_ws.messages.last).to include('type' => 'session_ended', 'reason' => 'error')
      expect(browser_ws.closed).to be(true)
    end
  end

  it 'drops transcript callbacks from a stale generation before allocating a turn' do
    state = described_class::ConnectionState.new
    state.session = session
    state.lease = lease
    state.generation = 1
    state.authoritative = true

    allow(lease).to receive(:authoritative?).and_return(false)
    expect(lease).not_to receive(:next_turn)

    callback = middleware.send(:build_on_input_transcription, browser_ws, state, session)
    callback.call('stale candidate text')
  end
end
