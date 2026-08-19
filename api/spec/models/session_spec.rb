# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Session, type: :model do
  let(:org) { Organization.find_by(scheme: 'test-corp') || Organization.create!(name: 'Test Corp', scheme: 'test-corp', identifier: 'test-corp', host: 'localhost') }
  let(:assessment) do
    Assessment.create!(
      tenant_id: org.id,
      created_by: 1,
      name: 'Senior Frontend Engineer',
      time_limit_min: 45
    )
  end

  describe 'callbacks' do
    it 'generates a 64-character hex invite token before validation on create' do
      session = Session.create!(tenant_id: org.id, assessment: assessment)
      expect(session.invite_token).to be_present
      expect(session.invite_token.length).to eq(64)
    end
  end

  describe '#invite_url' do
    it 'returns the frontend interview URL based on ALLOWED_ORIGINS' do
      session = Session.create!(tenant_id: org.id, assessment: assessment)
      expect(session.invite_url).to include("/interview/#{session.invite_token}")
      expect(session.invite_url).to start_with('http://localhost:5173')
    end
  end

  describe '#grant_consent!' do
    it 'updates candidate_consent, consented_at, and consent_locale' do
      session = Session.create!(tenant_id: org.id, assessment: assessment)
      expect(session.candidate_consent).to be false

      session.grant_consent!(locale: 'id')
      session.reload

      expect(session.candidate_consent).to be true
      expect(session.consented_at).to be_present
      expect(session.consent_locale).to eq('id')
    end
  end
end
