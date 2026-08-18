# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Session, 'Invite URL Target Configuration', type: :model do
  let!(:org) { Organization.create!(id: 401, scheme: 'test-corp', name: 'Test Corp', identifier: 'test-corp', host: 'localhost') }
  let!(:assessment) { Assessment.unscoped.create!(tenant_id: org.id, name: 'Invite URL Test Assessment', created_by: 1, time_limit_min: 30) }

  around do |example|
    original_base = ENV['FRONTEND_BASE_URL']
    example.run
  ensure
    if original_base.nil?
      ENV.delete('FRONTEND_BASE_URL')
    else
      ENV['FRONTEND_BASE_URL'] = original_base
    end
  end

  describe '#invite_url (INVITE-AC-01)' do
    let(:session) do
      Session.unscoped.create!(
        tenant_id: org.id,
        assessment_id: assessment.id,
        candidate_id: 789,
        candidate_name: 'Test Candidate'
      )
    end

    it 'formats invite_url with default frontend port 5173 when FRONTEND_BASE_URL is not set' do
      ENV.delete('FRONTEND_BASE_URL')

      expect(session.invite_token).to be_present
      expect(session.invite_url).to eq("http://localhost:5173/interview/#{session.invite_token}")
    end

    it 'formats invite_url with configured production-style FRONTEND_BASE_URL' do
      ENV['FRONTEND_BASE_URL'] = 'https://interviews.example.test'

      expect(session.invite_url).to eq("https://interviews.example.test/interview/#{session.invite_token}")
    end

    it 'robustly handles trailing slash in FRONTEND_BASE_URL without producing double slashes' do
      ENV['FRONTEND_BASE_URL'] = 'https://interviews.example.test/'

      expect(session.invite_url).to eq("https://interviews.example.test/interview/#{session.invite_token}")
    end
  end
end
