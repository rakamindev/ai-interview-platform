# frozen_string_literal: true

require 'rails_helper'

RSpec.describe CvScreenings::Inviter do
  it 'creates a session against the batch assessment, using the detected email as the candidate name' do
    screening = create(:cv_screening)
    batch = create(:cv_screening_batch, cv_screening: screening)
    entry = create(:cv_screening_entry, cv_screening_batch: batch, detected_email: 'jordan.example@test.invalid')

    session = described_class.new(entry: entry).call

    expect(session).to be_persisted
    expect(session.assessment_id).to eq(batch.assessment_id)
    expect(session.tenant_id).to eq(entry.tenant_id)
    expect(session.candidate_name).to eq('jordan.example@test.invalid')
  end
end
