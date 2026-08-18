# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Portfolios Security and Tenant Isolation', type: :request do
  let!(:org_a) { Organization.create!(id: 101, scheme: 'tenant-a', name: 'Tenant A', identifier: 'tenant-a', host: 'localhost') }
  let!(:org_b) { Organization.create!(id: 102, scheme: 'tenant-b', name: 'Tenant B', identifier: 'tenant-b', host: 'localhost') }

  let!(:user_a) { User.create!(email: 'assessor_a@example.com', password: 'password123', role: 'admin') }
  let!(:user_b) { User.create!(email: 'assessor_b@example.com', password: 'password123', role: 'admin') }

  let(:token_a) { JsonWebToken.encode({ user_id: user_a.id, role: 'admin', scheme: org_a.scheme }) }
  let(:token_b) { JsonWebToken.encode({ user_id: user_b.id, role: 'admin', scheme: org_b.scheme }) }

  let(:headers_tenant_a) { { 'Authorization' => "Bearer #{token_a}", 'Content-Type' => 'application/json' } }
  let(:headers_tenant_b) { { 'Authorization' => "Bearer #{token_b}", 'Content-Type' => 'application/json' } }

  let!(:assessment_a) { Assessment.unscoped.create!(tenant_id: org_a.id, name: 'Tenant A Assessment', created_by: user_a.id, time_limit_min: 30) }
  let!(:assessment_b) { Assessment.unscoped.create!(tenant_id: org_b.id, name: 'Tenant B Assessment', created_by: user_b.id, time_limit_min: 30) }

  let!(:session_a) { Session.unscoped.create!(tenant_id: org_a.id, assessment_id: assessment_a.id, candidate_id: 101, candidate_name: 'Candidate A', status: 'ended') }
  let!(:session_b) { Session.unscoped.create!(tenant_id: org_b.id, assessment_id: assessment_b.id, candidate_id: 202, candidate_name: 'Candidate B', status: 'ended') }

  let!(:portfolio_a) { Portfolio.create!(session_id: session_a.id, candidate_id: session_a.candidate_id, generation_status: 'complete', generated_at: 1.hour.ago) }
  let!(:portfolio_b) { Portfolio.create!(session_id: session_b.id, candidate_id: session_b.candidate_id, generation_status: 'complete', generated_at: 1.hour.ago) }

  let!(:skill_a) do
    portfolio_a.portfolio_skills.create!(
      skill_label: 'Skill A',
      ai_level: 4,
      ai_confidence: 'high',
      competency_summary: 'Demonstrated solid skills A.',
      evidence: ['Quote A']
    )
  end

  let!(:skill_b) do
    portfolio_b.portfolio_skills.create!(
      skill_label: 'Confidential Skill B',
      ai_level: 3,
      ai_confidence: 'high',
      competency_summary: 'Competency summary for candidate B.',
      evidence: ['Direct quote from candidate B']
    )
  end

  let!(:vacancy_a) { Vacancy.unscoped.create!(tenant_id: org_a.id, created_by: user_a.id, role_title: 'Engineer A', culture_dimensions: 'A', competency_expectations: 'A') }
  let!(:vacancy_b) { Vacancy.unscoped.create!(tenant_id: org_b.id, created_by: user_b.id, role_title: 'Engineer B', culture_dimensions: 'B', competency_expectations: 'B') }

  describe 'Cross-Tenant Access Rejections (SEC-AC-01 through SEC-AC-07)' do
    it '1. Tenant A cannot show Tenant B portfolio via session route (returns 404)' do
      get "/api/v1/sessions/#{session_b.id}/portfolio", headers: headers_tenant_a
      expect(response).to have_http_status(:not_found)
    end

    it '2. Tenant A cannot export Tenant B portfolio data (returns 404)' do
      get "/api/v1/portfolios/#{portfolio_b.id}/export?format=json", headers: headers_tenant_a
      expect(response).to have_http_status(:not_found)
    end

    it '3. Tenant A cannot override Tenant B portfolio skill (returns 404)' do
      post "/api/v1/portfolio_skills/#{skill_b.id}/override",
           headers: headers_tenant_a,
           params: { override: { override_level: 5, assessor_notes: 'Hacked override' } }.to_json
      expect(response).to have_http_status(:not_found)
      expect(skill_b.reload.assessor_override).to be_nil
    end

    it '4. Tenant A cannot trigger fit/gap on Tenant B portfolio (returns 404)' do
      post "/api/v1/portfolios/#{portfolio_b.id}/fitgap",
           headers: headers_tenant_a,
           params: { fitgap: { vacancy_id: vacancy_a.id } }.to_json
      expect(response).to have_http_status(:not_found)
    end

    it '5. Tenant A cannot regenerate fit/gap on Tenant B portfolio (returns 404)' do
      post "/api/v1/portfolios/#{portfolio_b.id}/regenerate_fitgap",
           headers: headers_tenant_a,
           params: { vacancy_id: vacancy_a.id }.to_json
      expect(response).to have_http_status(:not_found)
    end

    it '6. Tenant A cannot retrieve Tenant B fit/gap report (returns 404)' do
      get "/api/v1/portfolios/#{portfolio_b.id}/fitgap/#{vacancy_a.id}", headers: headers_tenant_a
      expect(response).to have_http_status(:not_found)
    end

    it '7. Portfolio and vacancy from different tenants cannot be combined (returns 404)' do
      post "/api/v1/portfolios/#{portfolio_a.id}/fitgap",
           headers: headers_tenant_a,
           params: { fitgap: { vacancy_id: vacancy_b.id } }.to_json
      expect(response).to have_http_status(:not_found)
    end

    it '9. Foreign and nonexistent resource IDs both return identical 404 responses' do
      get "/api/v1/portfolios/#{portfolio_b.id}/export?format=json", headers: headers_tenant_a
      foreign_body = response.body

      get "/api/v1/portfolios/999999/export?format=json", headers: headers_tenant_a
      nonexistent_body = response.body

      expect(response).to have_http_status(:not_found)
      expect(foreign_body).to eq(nonexistent_body)
    end
  end

  describe 'Same-Tenant Access Functional (SEC-AC-08)' do
    it '8a. Same-tenant portfolio show succeeds with 200 OK' do
      get "/api/v1/sessions/#{session_a.id}/portfolio", headers: headers_tenant_a
      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body['portfolio']['id']).to eq(portfolio_a.id)
    end

    it '8b. Same-tenant export succeeds with 200 OK' do
      get "/api/v1/portfolios/#{portfolio_a.id}/export?format=json", headers: headers_tenant_a
      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body['portfolio']['skills'].first['skill_label']).to eq('Skill A')
    end

    it '8c. Same-tenant skill override succeeds with 201 Created' do
      post "/api/v1/portfolio_skills/#{skill_a.id}/override",
           headers: headers_tenant_a,
           params: { override: { override_level: 5, assessor_notes: 'Valid override' } }.to_json
      expect(response).to have_http_status(:created)
      expect(skill_a.reload.assessor_override.override_level).to eq(5)
    end

    it '8d. Same-tenant fitgap trigger and regeneration succeed with 202 Accepted' do
      post "/api/v1/portfolios/#{portfolio_a.id}/fitgap",
           headers: headers_tenant_a,
           params: { vacancy_id: vacancy_a.id }.to_json
      expect(response).to have_http_status(:accepted)

      post "/api/v1/portfolios/#{portfolio_a.id}/regenerate_fitgap",
           headers: headers_tenant_a,
           params: { vacancy_id: vacancy_a.id }.to_json
      expect(response).to have_http_status(:accepted)
    end

    it '8e. Same-tenant show_fitgap succeeds with 200 OK when report exists' do
      FitGapReport.create!(
        portfolio_id: portfolio_a.id,
        vacancy_id: vacancy_a.id,
        skill_comparisons: [{ 'skill_id' => 'SK-ENG-001', 'result' => 'match' }],
        culture_narrative: 'Strong alignment',
        overall_narrative: 'Recommended candidate',
        generated_at: Time.current
      )

      get "/api/v1/portfolios/#{portfolio_a.id}/fitgap/#{vacancy_a.id}", headers: headers_tenant_a
      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body['report']['culture_narrative']).to eq('Strong alignment')
    end

    it '8f. Same-tenant portfolio show returns status unavailable and null portfolio when session has no portfolio' do
      empty_session = Session.unscoped.create!(tenant_id: org_a.id, assessment_id: assessment_a.id, candidate_id: 333, status: 'ended')
      get "/api/v1/sessions/#{empty_session.id}/portfolio", headers: headers_tenant_a
      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body['status']).to eq('unavailable')
      expect(body['portfolio']).to be_nil
    end
  end
end
