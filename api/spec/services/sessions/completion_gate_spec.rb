# frozen_string_literal: true

require_relative '../../spec_helper'
require_relative '../../../app/services/sessions/completion_gate'

RSpec.describe Sessions::CompletionGate do
  FakeSession = Struct.new(:status, :completion_authorized_at, keyword_init: true) do
    def active?
      status == 'active'
    end
  end

  it 'permits completion only after the active session has server authorization' do
    session = FakeSession.new(status: 'active', completion_authorized_at: Time.now)

    expect(described_class.allowed?(session)).to be(true)
  end

  it 'rejects an active session when a browser attempts completion early' do
    session = FakeSession.new(status: 'active', completion_authorized_at: nil)

    expect(described_class.allowed?(session)).to be(false)
  end

  it 'rejects an authorization marker from a non-active session' do
    session = FakeSession.new(status: 'pending', completion_authorized_at: Time.now)

    expect(described_class.allowed?(session)).to be(false)
  end
end
