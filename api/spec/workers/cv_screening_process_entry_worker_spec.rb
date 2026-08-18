# frozen_string_literal: true

require 'rails_helper'

RSpec.describe CvScreeningProcessEntryWorker do
  let(:entry) { create(:cv_screening_entry) }

  it 'processes a pending entry by delegating to CvScreenings::DecisionEngine' do
    expect(CvScreenings::DecisionEngine).to receive(:new).with(entry: entry).and_call_original
    allow_any_instance_of(CvScreenings::DecisionEngine).to receive(:call)

    described_class.new.perform(entry.id)
  end

  it 'is idempotent — a no-op for an entry that already has a decision' do
    entry.update!(decision: 'invited', decision_reason: 'auto_invited')

    expect(CvScreenings::DecisionEngine).not_to receive(:new)

    described_class.new.perform(entry.id)
  end

  it 'does not raise when the entry no longer exists' do
    expect { described_class.new.perform(0) }.not_to raise_error
  end

  it 're-asserts tenancy from the persisted row before processing' do
    allow(CvScreenings::DecisionEngine).to receive(:new).and_return(instance_double(CvScreenings::DecisionEngine, call: entry))

    described_class.new.perform(entry.id)

    # Current.tenant_id (no block) raises when unset — cleared in an `ensure`,
    # proving tenancy was set during the call and then cleared afterward.
    expect(RequestStore.store.key?(:tenant_id)).to be(false)
  end

  it 'lets a transient storage error propagate out of #perform so Sidekiq actually retries the job' do
    allow(CvScreenings::DecisionEngine).to receive(:new).and_raise(ActiveStorage::FileNotFoundError)

    expect { described_class.new.perform(entry.id) }.to raise_error(ActiveStorage::FileNotFoundError)
    expect(entry.reload.decision).to eq('pending')
  end

  describe 'sidekiq_retries_exhausted' do
    it 'marks the entry needs_review with model_failed — never not_advanced' do
      described_class.sidekiq_retries_exhausted_block.call({ 'args' => [entry.id] }, StandardError.new('boom'))

      expect(entry.reload.decision).to eq('needs_review')
      expect(entry.decision_reason).to eq('model_failed')
    end
  end
end
