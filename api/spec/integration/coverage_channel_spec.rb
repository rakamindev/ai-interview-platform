# frozen_string_literal: true

require 'rails_helper'

# The live monitor's data path: services publish to the Redis channel
# "coverage:<session id>", and CoverageWebSocketMiddleware forwards each message
# unchanged to the assessor's browser. These specs subscribe to the real Redis
# and pin down the exact messages, which are the contract the web hook
# (useCoverageWebSocket) reads. web/src/test/integration uses the same shapes.
RSpec.describe 'Coverage channel (Redis pub/sub)', type: :integration do
  let(:assessment) { create(:assessment, :with_skills) }
  let(:session)    { create(:session, assessment:) }

  # Subscribes first, runs the block, and returns the messages received.
  def published_during(count: 1, timeout: 5)
    received = []
    ready    = Queue.new
    channel  = "coverage:#{session.id}"
    redis    = Redis.new(url: ENV.fetch('REDIS_URL'))

    listener = Thread.new do
      redis.subscribe_with_timeout(timeout, channel) do |on|
        on.subscribe { ready << true }
        on.message do |_channel, message|
          received << JSON.parse(message)
          redis.unsubscribe if received.size >= count
        end
      end
    rescue Redis::TimeoutError
      nil
    end

    ready.pop
    yield
    listener.join(timeout + 1)
    received
  ensure
    redis&.close
  end

  it 'announces that the session started' do
    messages = published_during { Sessions::StartHandler.new(session).call }

    expect(messages).to eq([{ 'type' => 'session_status', 'status' => 'active', 'end_reason' => nil }])
  end

  it 'announces that the session ended, with the reason' do
    session.update!(status: 'active', started_at: 5.minutes.ago)

    messages = published_during { Sessions::EndHandler.new(session).call(reason: 'time_ceiling') }

    expect(messages).to eq([{ 'type' => 'session_status', 'status' => 'ended', 'end_reason' => 'time_ceiling' }])
  end

  it 'publishes the whole coverage map after each analysis' do
    session.coverage_maps.create!(skill_id: 'SK-ENG-001', skill_label: 'React', state: 'partial', probe_count: 2,
                                  last_signal: 'Profiled with React DevTools')
    session.coverage_maps.create!(skill_label: 'Micro-frontends', is_discovered: true, state: 'initiated', probe_count: 1)

    messages = published_during { CoverageAnalyzerWorker.new.send(:publish_coverage_update, session) }

    message = messages.sole
    expect(message['type']).to eq('coverage_update')
    expect(message['skills'].sole).to include(
      'skill_id' => 'SK-ENG-001', 'skill_label' => 'React', 'is_discovered' => false,
      'state' => 'partial', 'probe_count' => 2, 'last_signal' => 'Profiled with React DevTools'
    )
    expect(message['discovered'].sole).to include('skill_label' => 'Micro-frontends', 'state' => 'initiated')
    expect(message['skills'].sole.keys).to match_array(%w[id skill_id skill_label is_discovered state probe_count last_signal])
  end

  it 'publishes nothing for a second end' do
    session.update!(status: 'active', started_at: 5.minutes.ago)
    Sessions::EndHandler.new(session).call(reason: 'all_covered')

    messages = published_during(timeout: 1) { Sessions::EndHandler.new(session.reload).call(reason: 'time_ceiling') }

    expect(messages).to be_empty
  end
end
