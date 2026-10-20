# frozen_string_literal: true

require 'spec_helper'

RSpec.describe FitGapGeneratorWorker do
  let(:redis) { instance_double(Redis) }

  before do
    allow(Sidekiq).to receive(:redis).and_yield(redis)
    allow(SecureRandom).to receive(:hex).with(16).and_return('lease-token')
  end

  it 'queues one job while the portfolio-vacancy lease is available' do
    key = described_class.lock_key(12, 34)
    expect(redis).to receive(:set).with(key, 'lease-token', nx: true, ex: described_class::LOCK_TTL).and_return('OK')
    expect(described_class).to receive(:perform_async).with(12, 34, 'lease-token').and_return('job-id')

    expect(described_class.enqueue_once(12, 34)).to be(true)
  end

  it 'does not enqueue a duplicate while another lease exists' do
    expect(redis).to receive(:set).with(described_class.lock_key(12, 34), 'lease-token', nx: true, ex: described_class::LOCK_TTL).and_return(nil)
    expect(described_class).not_to receive(:perform_async)

    expect(described_class.enqueue_once(12, 34)).to be(false)
  end

  it 'releases its lease if Sidekiq does not accept the job' do
    key = described_class.lock_key(12, 34)
    allow(redis).to receive(:set).and_return('OK')
    allow(described_class).to receive(:perform_async).and_return(nil)
    expect(redis).to receive(:eval).with(described_class::RELEASE_LOCK_SCRIPT, keys: [key], argv: ['lease-token']).and_return(1)

    expect(described_class.enqueue_once(12, 34)).to be(false)
  end

  it 'does not release a newer lease when an old job finishes' do
    key = described_class.lock_key(12, 34)
    expect(redis).to receive(:eval).with(described_class::RELEASE_LOCK_SCRIPT, keys: [key], argv: ['old-token']).and_return(0)

    described_class.release_lock(key, 'old-token')
  end
end
