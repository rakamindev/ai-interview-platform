# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Session, type: :model do
  let(:org) do
    Organization.find_or_create_by!(scheme: 'test-corp') do |o|
      o.name = 'Test Corp'
      o.identifier = 'test-corp'
      o.host = 'localhost'
    end
  end

  let(:assessment) do
    Assessment.create!(
      tenant_id: org.id,
      created_by: 1,
      name: 'Fullstack Assessment',
      time_limit_min: 30
    )
  end

  describe 'validations and callbacks' do
    it 'generates a unique invite_token on create' do
      session = Session.create!(
        assessment: assessment,
        tenant_id: org.id,
        candidate_name: 'Test Candidate'
      )

      expect(session.invite_token).to be_present
      expect(session.invite_token.length).to eq(64) # 32 hex bytes = 64 chars
      expect(session.status).to eq('pending')
    end

    it 'validates status inclusion' do
      session = Session.new(
        assessment: assessment,
        tenant_id: org.id,
        status: 'invalid_status'
      )
      expect(session).not_to be_valid
      expect(session.errors[:status]).to be_present
    end
  end

  describe '#invite_url' do
    it 'resolves to frontend origin rather than backend api port' do
      session = Session.create!(
        assessment: assessment,
        tenant_id: org.id,
        candidate_name: 'John Doe'
      )

      url = session.invite_url
      expect(url).to include("/interview/#{session.invite_token}")
      expect(url).not_to include(':3001')
      expect(url).to include(':5173')
    end

    it 'respects explicit FRONTEND_URL env var if provided' do
      session = Session.create!(
        assessment: assessment,
        tenant_id: org.id,
        candidate_name: 'Jane Doe'
      )

      allow(ENV).to receive(:[]).and_call_original
      allow(ENV).to receive(:[]).with('FRONTEND_URL').and_return('https://app.example.com')

      expect(session.invite_url).to eq("https://app.example.com/interview/#{session.invite_token}")
    end
  end
end
