# frozen_string_literal: true

require 'rails_helper'

RSpec.describe CandidateDataDeletionJob, type: :job do
  let(:organization) { create(:organization) }
  let(:assessment)   { create(:assessment, tenant_id: organization.id) }
  let(:session) do
    create(:session,
           tenant_id: organization.id,
           assessment: assessment,
           candidate_id: 4242,
           candidate_name: 'Nabil Test')
  end

  before do
    create(:consent, session: session, tenant_id: organization.id)
    create(:transcript_turn, session: session, text: 'sensitive candidate answer')
    session.create_portfolio!(candidate_id: session.candidate_id, generation_status: 'complete')
  end

  it 'revokes consent, removes transcript + portfolio, and nulls identity (AC-B3)' do
    CandidateDataDeletionJob.new.perform(session.id)

    session.reload
    expect(session.consent).to be_revoked
    expect(session.transcript_turns.count).to eq(0)
    expect(session.portfolio).to be_nil
    expect(session.candidate_name).to be_nil
    expect(session.candidate_id).to be_nil
  end

  it 'is idempotent — running twice is safe' do
    2.times { CandidateDataDeletionJob.new.perform(session.id) }

    session.reload
    expect(session.consent).to be_revoked
    expect(session.transcript_turns.count).to eq(0)
    expect(session.candidate_name).to be_nil
  end

  it 'skips silently when the session does not exist' do
    expect { CandidateDataDeletionJob.new.perform(99_999_999) }.not_to raise_error
  end
end