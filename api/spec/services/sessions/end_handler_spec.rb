# frozen_string_literal: true

require 'rails_helper'

# Every unexpected session ending used to collapse into end_reason 'error',
# which left an assessor unable to decide between inviting the candidate
# again, waiting for the provider, and paging engineering. These specs cover
# the classification that replaced that single bucket, and the two properties
# that make the class worth recording at all: that an unknown one is discarded
# rather than stored, and that a recorded one is not erased afterwards.
RSpec.describe Sessions::EndHandler do
  let(:organization) { create(:organization) }
  let(:session) { create(:session, :active, tenant_id: organization.id) }

  before do
    # Enqueuing reaches Redis, and nothing under test here depends on the
    # generation job actually running.
    allow(PortfolioGeneratorWorker).to receive(:perform_async)
  end

  def end_with(reason:, failure_class: nil)
    described_class.new(session).call(reason: reason, failure_class: failure_class)
  end

  describe 'failure_class' do
    it 'is recorded alongside an error ending' do
      end_with(reason: 'error', failure_class: 'transient')

      expect(session.reload.failure_class).to eq('transient')
    end

    it 'is left nil when no failure is reported, so a clean ending stays clean' do
      end_with(reason: 'all_covered')

      expect(session.reload.end_reason).to eq('all_covered')
      expect(session.reload.failure_class).to be_nil
    end

    it 'discards a class outside the documented set instead of storing it' do
      # Storing whatever arrived would make the class meaningless: the
      # assessor's UI only understands the four documented values, and an
      # unrecognised one would render as no explanation at all.
      end_with(reason: 'error', failure_class: 'catastrophe')

      expect(session.reload.failure_class).to be_nil
    end

    it 'is not tied to an error ending, so an outage mid-interview is still recorded' do
      # A session can hit its time ceiling and still have suffered a provider
      # outage halfway through. Dropping the class here would hide precisely
      # the information the assessor needs, because the ending itself was
      # normal and would otherwise look uneventful.
      end_with(reason: 'time_ceiling', failure_class: 'transient')

      expect(session.reload.end_reason).to eq('time_ceiling')
      expect(session.reload.failure_class).to eq('transient')
    end

    it 'survives a later clean manual ending instead of being erased' do
      end_with(reason: 'error', failure_class: 'user')

      # The session is already ended, so a manual end arriving afterwards only
      # upgrades end_reason. It must not destroy the record of what actually
      # happened to this candidate.
      described_class.new(session.reload).call(reason: 'manual_candidate')

      expect(session.reload.end_reason).to eq('manual_candidate')
      expect(session.reload.failure_class).to eq('user')
    end
  end

  it 'refuses to hold a class the model does not know' do
    session.failure_class = 'catastrophe'

    expect(session).not_to be_valid
    expect(session.errors[:failure_class]).not_to be_empty
  end
end
