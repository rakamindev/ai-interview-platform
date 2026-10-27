# frozen_string_literal: true

require 'rails_helper'

RSpec.describe AudioWebSocketMiddleware do
  describe '.get_or_create_state and .cleanup_state' do
    it 'returns the same state object for identical session IDs' do
      state1 = described_class.get_or_create_state(999)
      state2 = described_class.get_or_create_state('999')

      expect(state1).to be(state2)
      expect(state1.session_id).to eq('999')
    ensure
      described_class.cleanup_state(999)
    end

    it 'cleans up session state and releases resources' do
      state = described_class.get_or_create_state(888)
      expect(described_class.active_sessions['888']).to be(state)

      described_class.cleanup_state(888)
      expect(described_class.active_sessions['888']).to be_nil
    end
  end

  describe '.run_async' do
    it 'executes a database block asynchronously via the bounded task pool' do
      latch = Concurrent::CountDownLatch.new(1)
      executed = false

      described_class.run_async do
        executed = true
        latch.count_down
      end

      latch.wait(2)
      expect(executed).to be(true)
    end
  end
end
