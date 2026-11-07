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
  let(:headers) do
    token = JsonWebToken.encode(user_id: 1, role: 'admin', scheme: organization.scheme)
    { 'Authorization' => "Bearer #{token}", 'Content-Type' => 'application/json' }
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

  describe 'POST /sessions/:id/portfolio/regenerate' do
    before { allow(PortfolioGeneratorWorker).to receive(:perform_async) }

    it 'refuses a session with no candidate answers, because retrying cannot help' do
      session = session_with(status: 'ended', end_reason: 'manual_candidate')
      session.create_portfolio!(generation_status: 'failed', generation_error: Portfolio::NO_CANDIDATE_ANSWERS)

      post "/api/v1/sessions/#{session.id}/portfolio/regenerate", headers: headers

      expect(response).to have_http_status(:unprocessable_entity)
      expect(PortfolioGeneratorWorker).not_to have_received(:perform_async)
    end

    it 'still retries a portfolio that failed for another reason' do
      session = session_with(status: 'ended', end_reason: 'manual_candidate')
      session.create_portfolio!(generation_status: 'failed', generation_error: 'Rate limited')

      post "/api/v1/sessions/#{session.id}/portfolio/regenerate", headers: headers

      expect(response).to have_http_status(:ok)
      expect(PortfolioGeneratorWorker).to have_received(:perform_async).with(session.id)
    end
  end
end
# rubocop:enable Metrics/BlockLength
