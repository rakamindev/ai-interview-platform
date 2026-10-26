# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Sessions::ConnectionTracker do
  let(:session_id) { "spec-#{SecureRandom.hex(4)}" }

  after { Sidekiq.redis { |r| r.call('DEL', described_class.key(session_id)) } }

  it 'knows a candidate rejoined after the disconnect' do
    dropped_at = Time.current
    described_class.connected!(session_id, at: dropped_at + 30)

    expect(described_class.reconnected_after?(session_id, dropped_at)).to be(true)
  end

  it 'does not count the connection that later dropped' do
    connected_at = Time.current
    described_class.connected!(session_id, at: connected_at)

    expect(described_class.reconnected_after?(session_id, connected_at + 5)).to be(false)
  end

  it 'is false when the session never connected' do
    expect(described_class.reconnected_after?(session_id, Time.current)).to be(false)
  end
end
