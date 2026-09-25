# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Session, type: :model do
  let(:tenant) do
    Organization.first || Organization.create!(
      name: 'Rakamin Spec',
      scheme: 'rakamin_spec',
      identifier: 'rakamin-spec',
      host: 'spec.rakamin.com'
    )
  end

  let(:assessment) do
    Assessment.create!(
      tenant_id: tenant.id,
      created_by: 1,
      name: 'Senior Frontend Developer',
      time_limit_min: 45
    )
  end

  before do
    Current.organization = tenant
    Current.tenant_id = tenant.id
  end

  after do
    Current.clear
  end

  describe 'creation and token generation' do
    it 'automatically generates a secure 64-char hex invite token' do
      session = Session.create!(
        tenant_id: tenant.id,
        assessment: assessment,
        status: 'pending'
      )

      expect(session.invite_token).to be_present
      expect(session.invite_token.length).to eq(64)
      expect(session.invite_url).to include("/interview/#{session.invite_token}")
    end

    it 'generates invite_url pointing to frontend web app and not backend API (Finding F-2)' do
      session = Session.create!(
        tenant_id: tenant.id,
        assessment: assessment,
        status: 'pending'
      )

      base_url = ENV.fetch('APP_BASE_URL', 'http://localhost:5173')
      expect(session.invite_url).to start_with(base_url)
      expect(session.invite_url).not_to include(':3001')
      expect(session.invite_url).not_to include('/api/v1')
      expect(session.invite_url).to eq("#{base_url}/interview/#{session.invite_token}")
    end

    it 'persists candidate_name properly' do
      session = Session.create!(
        tenant_id: tenant.id,
        assessment: assessment,
        candidate_name: 'Budi Pratama',
        status: 'pending'
      )

      expect(session.reload.candidate_name).to eq('Budi Pratama')
    end

    it 'allows updating candidate_name dynamically' do
      session = Session.create!(
        tenant_id: tenant.id,
        assessment: assessment,
        status: 'pending'
      )

      expect(session.candidate_name).to be_nil

      session.update!(candidate_name: 'Siti Nurhaliza')
      expect(session.reload.candidate_name).to eq('Siti Nurhaliza')
    end
  end

  describe 'status helper methods' do
    it 'correctly reflects pending, active, and ended states' do
      session = Session.create!(
        tenant_id: tenant.id,
        assessment: assessment,
        status: 'pending'
      )

      expect(session.pending?).to be true
      expect(session.active?).to be false
      expect(session.ended?).to be false

      session.update!(status: 'active', started_at: Time.current)
      expect(session.active?).to be true

      session.update!(status: 'ended', ended_at: Time.current, end_reason: 'manual_candidate')
      expect(session.ended?).to be true
    end
  end
end
