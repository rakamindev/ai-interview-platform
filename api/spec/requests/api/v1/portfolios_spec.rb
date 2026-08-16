# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Api::V1::Portfolios', type: :request do
  let!(:org_a) do
    Organization.create!(
      name: 'Tenant A',
      scheme: 'tenant-a',
      identifier: 'tenant-a',
      host: 'tenant-a.com'
    )
  end

  let!(:org_b) do
    Organization.create!(
      name: 'Tenant B',
      scheme: 'tenant-b',
      identifier: 'tenant-b',
      host: 'tenant-b.com'
    )
  end

  # Create users for each tenant
  let(:token_a) { JsonWebToken.encode({ user_id: 101, role: 'admin', scheme: 'tenant-a' }) }
  let(:token_b) { JsonWebToken.encode({ user_id: 102, role: 'admin', scheme: 'tenant-b' }) }

  let(:headers_a) { { 'Authorization' => "Bearer #{token_a}" } }
  let(:headers_b) { { 'Authorization' => "Bearer #{token_b}" } }

  # Setup assessments for both tenants
  let!(:assessment_a) { Assessment.create!(tenant_id: org_a.id, name: 'Assess A', time_limit_min: 30, created_by: 101) }
  let!(:assessment_b) { Assessment.create!(tenant_id: org_b.id, name: 'Assess B', time_limit_min: 30, created_by: 102) }

  # Setup sessions
  let!(:session_a) do
    Session.create!(
      tenant_id: org_a.id,
      assessment: assessment_a,
      invite_token: 'token-a-session',
      candidate_name: 'Budi Tenant A',
      status: 'ended'
    )
  end

  let!(:session_b) do
    Session.create!(
      tenant_id: org_b.id,
      assessment: assessment_b,
      invite_token: 'token-b-session',
      candidate_name: 'Budi Tenant B',
      status: 'ended'
    )
  end

  # Setup portfolios
  let!(:portfolio_a) do
    Portfolio.create!(
      session: session_a,
      generation_status: 'complete',
      generated_at: Time.zone.now
    )
  end

  let!(:portfolio_b) do
    Portfolio.create!(
      session: session_b,
      generation_status: 'complete',
      generated_at: Time.zone.now
    )
  end

  # Setup vacancy for FitGap tests
  let!(:vacancy_a) { Vacancy.create!(tenant_id: org_a.id, role_title: 'Developer A', created_by: 101) }
  let!(:vacancy_b) { Vacancy.create!(tenant_id: org_b.id, role_title: 'Developer B', created_by: 102) }

  describe 'GET /api/v1/sessions/:id/portfolio' do
    context 'when authenticated as Tenant A' do
      it 'allows retrieving its own portfolio' do
        get "/api/v1/sessions/#{session_a.id}/portfolio", headers: headers_a
        expect(response).to have_http_status(:ok)
      end

      it 'blocks retrieving Tenant B portfolio (BOLA/IDOR)' do
        get "/api/v1/sessions/#{session_b.id}/portfolio", headers: headers_a
        # Target expectation is 404 or 403. Currently it is likely 200/accepted (vulnerable).
        expect(response).to have_http_status(:not_found).or(have_http_status(:forbidden))
      end
    end
  end

  describe 'POST /api/v1/sessions/:id/portfolio/regenerate' do
    context 'when authenticated as Tenant A' do
      before do
        portfolio_a.update!(generation_status: 'failed')
        portfolio_b.update!(generation_status: 'failed')
      end

      it 'allows regenerating its own portfolio' do
        post "/api/v1/sessions/#{session_a.id}/portfolio/regenerate", headers: headers_a
        expect(response).to have_http_status(:ok)
      end

      it 'blocks regenerating Tenant B portfolio' do
        post "/api/v1/sessions/#{session_b.id}/portfolio/regenerate", headers: headers_a
        expect(response).to have_http_status(:not_found).or(have_http_status(:forbidden))
      end
    end
  end

  describe 'GET /api/v1/portfolios/:id/export' do
    context 'when authenticated as Tenant A' do
      it 'allows exporting its own portfolio' do
        get "/api/v1/portfolios/#{portfolio_a.id}/export?format=json", headers: headers_a
        expect(response).to have_http_status(:ok)
      end

      it 'blocks exporting Tenant B portfolio' do
        get "/api/v1/portfolios/#{portfolio_b.id}/export?format=json", headers: headers_a
        expect(response).to have_http_status(:not_found).or(have_http_status(:forbidden))
      end
    end
  end

  describe 'POST /api/v1/portfolios/:id/fitgap' do
    context 'when authenticated as Tenant A' do
      it 'allows generating fitgap for its own portfolio and vacancy' do
        post "/api/v1/portfolios/#{portfolio_a.id}/fitgap",
             params: { fitgap: { vacancy_id: vacancy_a.id } },
             headers: headers_a
        expect(response).to have_http_status(:accepted).or(have_http_status(:ok))
      end

      it 'blocks generating fitgap on another tenant portfolio' do
        post "/api/v1/portfolios/#{portfolio_b.id}/fitgap",
             params: { fitgap: { vacancy_id: vacancy_a.id } },
             headers: headers_a
        expect(response).to have_http_status(:not_found).or(have_http_status(:forbidden))
      end

      it 'blocks linking to another tenant vacancy' do
        post "/api/v1/portfolios/#{portfolio_a.id}/fitgap",
             params: { fitgap: { vacancy_id: vacancy_b.id } },
             headers: headers_a
        expect(response).to have_http_status(:not_found).or(have_http_status(:forbidden))
      end
    end
  end

end
