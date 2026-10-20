# frozen_string_literal: true

require 'rails_helper'

RSpec.describe CoverageWebSocketMiddleware do
  let(:app) { ->(env) { [200, { 'Content-Type' => 'text/plain' }, ['OK']] } }
  let(:middleware) { described_class.new(app) }
  let(:channel) { 'coverage:test_session_123' }
  let(:mock_ws_1) { double('Faye::WebSocket', send: true) }
  let(:mock_ws_2) { double('Faye::WebSocket', send: true) }

  after(:each) do
    described_class.reset_channels!
  end

  describe '.subscribe and .unsubscribe connection pooling' do
    it 'shares a single Redis subscription thread across multiple assessors on the same channel' do
      unsub_queue = Queue.new
      mock_redis = instance_double(Redis, disconnect!: true)
      allow(mock_redis).to receive(:subscribe) do |_ch, &_block|
        unsub_queue.pop
      end
      allow(mock_redis).to receive(:unsubscribe) do |_ch|
        unsub_queue.push(:done)
      end
      allow(Redis).to receive(:new).and_return(mock_redis)

      threads_before = Thread.list.count

      # First assessor subscribes
      described_class.subscribe(channel, mock_ws_1)

      expect(described_class.channels[channel][:sockets].count).to eq(1)
      expect(described_class.channels[channel][:sockets]).to include(mock_ws_1)

      # Second assessor subscribes to the same session
      described_class.subscribe(channel, mock_ws_2)

      # Only 1 Redis instance created for both assessors
      expect(Redis).to have_received(:new).once
      expect(described_class.channels[channel][:sockets].count).to eq(2)
      expect(described_class.channels[channel][:sockets]).to include(mock_ws_1, mock_ws_2)

      # First assessor disconnects
      described_class.unsubscribe(channel, mock_ws_1)

      expect(described_class.channels[channel][:sockets].count).to eq(1)
      expect(described_class.channels[channel][:sockets]).to include(mock_ws_2)
      expect(mock_redis).not_to have_received(:unsubscribe)

      # Second assessor disconnects -> channel unsubscribes and cleans up
      expect(mock_redis).to receive(:unsubscribe).with(channel)
      expect(mock_redis).to receive(:disconnect!)

      described_class.unsubscribe(channel, mock_ws_2)

      expect(described_class.channels[channel]).to be_nil
    end
  end
end
