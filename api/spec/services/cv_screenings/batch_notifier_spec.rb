# frozen_string_literal: true

require 'rails_helper'

RSpec.describe CvScreenings::BatchNotifier do
  let(:screening) { create(:cv_screening) }
  let(:batch) { create(:cv_screening_batch, cv_screening: screening) }

  def invited_entry(email: 'a@test.invalid')
    session = create(:session, assessment: screening.assessment, tenant_id: screening.tenant_id)
    create(:cv_screening_entry, cv_screening_batch: batch, decision: 'invited', detected_email: email,
                                 session: session)
  end

  def rejected_entry(email: 'b@test.invalid')
    create(:cv_screening_entry, cv_screening_batch: batch, decision: 'not_advanced', detected_email: email,
                                 feedback_text: 'Thanks for applying.')
  end

  describe '#evaluate_after_entry_decision' do
    it 'does nothing while entries are still pending' do
      invited_entry
      create(:cv_screening_entry, cv_screening_batch: batch)

      expect { described_class.new(batch).evaluate_after_entry_decision }
        .not_to change { batch.reload.notification_status }

      expect(ActionMailer::Base.deliveries).to be_empty
    end

    it 'releases immediately even when every auto-decided entry landed on the same outcome' do
      invited_entry
      invited_entry

      described_class.new(batch).evaluate_after_entry_decision

      expect(batch.reload.notification_status).to eq('released')
      expect(ActionMailer::Base.deliveries.size).to eq(2)
    end

    it 'releases immediately when outcomes are mixed' do
      invited_entry
      rejected_entry

      described_class.new(batch).evaluate_after_entry_decision

      expect(batch.reload.notification_status).to eq('released')
      expect(ActionMailer::Base.deliveries.size).to eq(2)
    end

    it 'stays pending when nothing auto-decided yet (every entry needs_review)' do
      create(:cv_screening_entry, cv_screening_batch: batch, decision: 'needs_review')

      described_class.new(batch).evaluate_after_entry_decision

      expect(batch.reload.notification_status).to eq('pending')
      expect(ActionMailer::Base.deliveries).to be_empty
    end

    it 'still notifies once a needs_review entry is later actually decided (e.g. via Re-analyze)' do
      entry = create(:cv_screening_entry, cv_screening_batch: batch, decision: 'needs_review')
      described_class.new(batch).evaluate_after_entry_decision # first pass: nothing decided yet
      expect(batch.reload.notification_status).to eq('pending')

      entry.update!(decision: 'not_advanced', detected_email: 'c@test.invalid', feedback_text: 'Thanks.')
      described_class.new(batch).evaluate_after_entry_decision # second pass: now decided

      expect(batch.reload.notification_status).to eq('released')
      expect(ActionMailer::Base.deliveries.size).to eq(1)
    end
  end

  describe '#release!' do
    it 'sends every queued email and marks entries notified' do
      entry = invited_entry

      described_class.new(batch).release!

      expect(entry.reload.notified_at).to be_present
      expect(batch.reload.notification_status).to eq('released')
      expect(ActionMailer::Base.deliveries.size).to eq(1)
    end

    it 'does not double-send an already-notified entry' do
      entry = invited_entry
      entry.update!(notified_at: Time.current)

      described_class.new(batch).release!

      expect(ActionMailer::Base.deliveries).to be_empty
    end
  end

  describe '.send_now!' do
    it 'sends immediately regardless of batch uniformity — the manual-review path' do
      entry = invited_entry

      described_class.send_now!(entry)

      expect(entry.reload.notified_at).to be_present
      expect(ActionMailer::Base.deliveries.size).to eq(1)
    end
  end
end
