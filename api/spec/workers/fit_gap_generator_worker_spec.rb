# frozen_string_literal: true

require 'rails_helper'

RSpec.describe FitGapGeneratorWorker do
  let(:portfolio) { create(:portfolio) }
  let(:vacancy) { create(:vacancy) }
  let!(:token) { FitGap::GenerationLock.acquire(portfolio.id, vacancy.id) }

  it 'releases the lock it was given when it succeeds' do
    allow(FitGap::Engine).to receive(:new).and_return(instance_double(FitGap::Engine, call: nil))

    described_class.new.perform(portfolio.id, vacancy.id, token)

    expect(FitGap::GenerationLock.held?(portfolio.id, vacancy.id)).to be(false)
  end

  it 'releases the lock it was given when it fails, so a retry or a new request can run' do
    allow(FitGap::Engine).to receive(:new).and_raise(ActiveRecord::StatementInvalid, 'boom')

    expect { described_class.new.perform(portfolio.id, vacancy.id, token) }.to raise_error(ActiveRecord::StatementInvalid)
    expect(FitGap::GenerationLock.held?(portfolio.id, vacancy.id)).to be(false)
  end

  it "leaves another job's lock alone when it runs without one (an override refresh)" do
    allow(FitGap::Engine).to receive(:new).and_return(instance_double(FitGap::Engine, call: nil))

    described_class.new.perform(portfolio.id, vacancy.id)

    expect(FitGap::GenerationLock.held?(portfolio.id, vacancy.id)).to be(true)
  end

  it "leaves the lock alone when its token is stale (the lock expired and someone else took it)" do
    allow(FitGap::Engine).to receive(:new).and_return(instance_double(FitGap::Engine, call: nil))

    described_class.new.perform(portfolio.id, vacancy.id, 'expired-token')

    expect(FitGap::GenerationLock.held?(portfolio.id, vacancy.id)).to be(true)
  end
end
