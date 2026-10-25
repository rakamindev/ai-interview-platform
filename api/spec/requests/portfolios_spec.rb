# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Portfolios API', type: :request do
  describe 'IDOR prevention (F-01 fix)' do
    let(:org_alpha) do
      Organization.create!(
        name: 'Alpha Corp',
        scheme: 'alpha-test',
        identifier: 'alpha-test',
        host: 'alpha.test.local'
      )
    end

    let(:org_beta) do
      Organization.create!(
        name: 'Beta Corp',
        scheme: 'beta-test',
        identifier: 'beta-test',
        host: 'beta.test.local'
      )
    end

    def create_portfolio(org, candidate_id)
      Current.using(tenant_id: org.id) do
        assessment = Assessment.create!(
          name: "#{candidate_id} Assessment",
          tenant_id: org.id,
          created_by: 1,
          time_limit_min: 30
        )
        session = Session.create!(
          assessment_id: assessment.id,
          tenant_id: org.id,
          candidate_id: candidate_id,
          candidate_name: "Candidate #{candidate_id}",
          status: 'ended'
        )
        Portfolio.create!(
          session: session,
          candidate_id: candidate_id,
          generation_status: 'complete'
        )
      end
    end

    let!(:portfolio_alpha) { create_portfolio(org_alpha, 'cand-alpha') }
    let!(:portfolio_beta) { create_portfolio(org_beta, 'cand-beta') }

    let(:token_alpha) do
      JsonWebToken.encode({ user_id: 1, role: 'admin', scheme: org_alpha.scheme })
    end

    let(:token_beta) do
      JsonWebToken.encode({ user_id: 2, role: 'admin', scheme: org_beta.scheme })
    end

    describe 'GET /api/v1/portfolios/:id/export' do
      context 'when assessor from tenant Beta tries to access portfolio from tenant Alpha' do
        it 'returns 404 (portfolio not found due to tenant scope)' do
          get "/api/v1/portfolios/#{portfolio_alpha.id}/export",
              params: { format: 'json' },
              headers: { 'Authorization' => "Bearer #{token_beta}" }

          expect(response).to have_http_status(:not_found)
        end
      end

      context 'when assessor from tenant Alpha accesses their own portfolio' do
        it 'returns 200 with portfolio data' do
          get "/api/v1/portfolios/#{portfolio_alpha.id}/export",
              params: { format: 'json' },
              headers: { 'Authorization' => "Bearer #{token_alpha}" }

          expect(response).to have_http_status(:ok)
          json = JSON.parse(response.body)
          expect(json['portfolio']['id']).to eq(portfolio_alpha.id)
        end
      end
    end

    describe 'POST /api/v1/portfolios/:id/regenerate_fitgap' do
      let(:vacancy_alpha) do
        Current.using(tenant_id: org_alpha.id) do
          Vacancy.create!(role_title: 'Senior Developer', tenant_id: org_alpha.id, created_by: 1)
        end
      end

      context 'when assessor from tenant Beta tries to regenerate fitgap for portfolio from tenant Alpha' do
        it 'returns 404 (portfolio not found due to tenant scope)' do
          post "/api/v1/portfolios/#{portfolio_alpha.id}/regenerate_fitgap",
               params: { vacancy_id: vacancy_alpha.id },
               headers: { 'Authorization' => "Bearer #{token_beta}" }

          expect(response).to have_http_status(:not_found)
        end
      end
    end

    describe 'POST /api/v1/portfolios/:id/fitgap' do
      context 'when assessor from tenant Beta tries to view fitgap from tenant Alpha' do
        it 'returns 404 (portfolio not found due to tenant scope)' do
          post "/api/v1/portfolios/#{portfolio_alpha.id}/fitgap",
               params: { vacancy_id: 1 },
               headers: { 'Authorization' => "Bearer #{token_beta}" }

          expect(response).to have_http_status(:not_found)
        end
      end
    end
  end

  describe 'GET /api/v1/sessions/:id/portfolio — partial status (F-08 fix)' do
    let(:org) do
      Organization.create!(
        name: 'Partial Corp',
        scheme: 'partial-test',
        identifier: 'partial-test',
        host: 'partial.test.local'
      )
    end

    let(:assessment) do
      Current.using(tenant_id: org.id) do
        Assessment.create!(
          name: 'Partial Assessment',
          tenant_id: org.id,
          created_by: 1,
          time_limit_min: 30
        )
      end
    end

    let(:session) do
      Current.using(tenant_id: org.id) do
        Session.create!(
          assessment_id: assessment.id,
          tenant_id: org.id,
          candidate_id: 'cand-partial',
          candidate_name: 'Partial Candidate',
          status: 'ended'
        )
      end
    end

    let!(:portfolio) do
      Current.using(tenant_id: org.id) do
        p = Portfolio.create!(
          session: session,
          candidate_id: 'cand-partial',
          generation_status: 'partial',
          generation_error: 'Some skills could not be saved (1): TypeScript: Competency summary can\'t be blank'
        )
        p.portfolio_skills.create!(
          skill_label: 'React',
          ai_level: 3,
          ai_confidence: 'high',
          evidence: ['quote'],
          competency_summary: 'Summary',
          is_discovered: false
        )
        p
      end
    end

    let(:token) do
      JsonWebToken.encode({ user_id: 1, role: 'admin', scheme: org.scheme })
    end

    it 'returns the portfolio with partial status and its saved skills' do
      get "/api/v1/sessions/#{session.id}/portfolio",
          headers: { 'Authorization' => "Bearer #{token}" }

      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)
      expect(json['portfolio']['generation_status']).to eq('partial')
      expect(json['portfolio']['generation_error']).to include('TypeScript')
      expect(json['portfolio']['skills'].length).to eq(1)
      expect(json['portfolio']['skills'].first['ai_confidence']).to eq('high')
      expect(json['portfolio']['skills'].first['evidence']).to eq([{
        'quote' => 'quote',
        'turn_id' => nil,
        'turn_number' => nil,
        'verification_status' => 'legacy'
      }])
      expect(json['portfolio']['skills'].first['evidence_status']).to eq('legacy')
    end
  end
end
