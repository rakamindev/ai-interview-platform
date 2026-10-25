# frozen_string_literal: true

require 'rails_helper'

# F-05 — Candidate invite link must point to the FRONTEND (web app), not the API host.
# The web app owns the `/interview/:token` route (web/src/App.tsx), so `invite_url` is
# built from FRONTEND_BASE_URL. APP_BASE_URL keeps meaning the API host and must be
# unaffected by this change.
RSpec.describe Session, type: :model do
  let(:org) do
    Organization.create!(
      name: 'Alpha Corp',
      scheme: 'alpha-test',
      identifier: 'alpha-test',
      host: 'alpha.test.local'
    )
  end

  let(:assessment) do
    Assessment.create!(name: 'F05', tenant_id: org.id, created_by: 1, time_limit_min: 30)
  end

  def build_session
    Current.using(tenant_id: org.id) do
      Session.create!(
        assessment_id: assessment.id, tenant_id: org.id,
        candidate_id: 'cand-1', candidate_name: 'Cand', status: 'active'
      )
    end
  end

  describe '#invite_url' do
    after do
      ENV.delete('FRONTEND_BASE_URL')
      ENV.delete('APP_BASE_URL')
    end

    it 'uses FRONTEND_BASE_URL as the host (points to the web app)' do
      ENV['FRONTEND_BASE_URL'] = 'https://ai-interview.rakamin.com'
      session = build_session
      expect(session.invite_url).to eq(
        "https://ai-interview.rakamin.com/interview/#{session.invite_token}"
      )
    end

    it 'defaults to the frontend dev host (localhost:5173) when unset' do
      ENV.delete('FRONTEND_BASE_URL')
      session = build_session
      expect(session.invite_url).to eq("http://localhost:5173/interview/#{session.invite_token}")
    end

    it 'is NOT affected by APP_BASE_URL (regression: API host must not leak into invite links)' do
      ENV['FRONTEND_BASE_URL'] = 'http://localhost:5173'
      ENV['APP_BASE_URL'] = 'http://localhost:3001'
      session = build_session
      expect(session.invite_url).not_to include('localhost:3001')
      expect(session.invite_url).to start_with('http://localhost:5173/interview/')
    end
  end
end
