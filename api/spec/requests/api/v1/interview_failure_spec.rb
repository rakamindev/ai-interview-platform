# frozen_string_literal: true

require 'rails_helper'

# rubocop:disable Metrics/BlockLength
RSpec.describe 'API V1 interview failure states', type: :request do
  let!(:organization) do
    Organization.create!(name: 'Test Corp', scheme: 'test-corp', identifier: 'test-corp', host: 'test.example.test')
  end
  let!(:assessment) do
    Assessment.unscoped.create!(
      tenant_id: organization.id, created_by: 1, name: 'Failure', time_limit_min: 45, language: 'en'
    )
  end
  def session_with(**attrs)
    Session.unscoped.create!(tenant_id: organization.id, assessment: assessment, **attrs)
  end

  describe 'GET /sessions/:token/candidate' do
    def candidate_info(session)
      get "/api/v1/sessions/#{session.invite_token}/candidate"
      response.parsed_body
    end

    it 'flags a session that ended because of an error' do
      body = candidate_info(session_with(status: 'ended', end_reason: 'error'))

      expect(body).to include('session_status' => 'ended', 'ended_with_error' => true)
    end

    it 'does not flag a session that ended normally' do
      body = candidate_info(session_with(status: 'ended', end_reason: 'manual_candidate'))

      expect(body['ended_with_error']).to be(false)
    end

    it 'does not flag a session that has not started' do
      expect(candidate_info(session_with)['ended_with_error']).to be(false)
    end
  end
end
# rubocop:enable Metrics/BlockLength
