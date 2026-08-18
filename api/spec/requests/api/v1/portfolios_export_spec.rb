# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Portfolio Export Security with Vacancies', type: :request do
  let!(:org_a) { Organization.create!(id: 280, scheme: 'tenant-a', name: 'Tenant A', identifier: 'tenant-a', host: 'localhost') }
  let!(:org_b) { Organization.create!(id: 281, scheme: 'tenant-b', name: 'Tenant B', identifier: 'tenant-b', host: 'localhost') }

  let!(:user_a) { User.create!(email: 'assessor_exp@example.com', password: 'password123', role: 'admin') }
  let(:token_a) { JsonWebToken.encode({ user_id: user_a.id, role: 'admin', scheme: org_a.scheme }) }
  let(:headers_a) { { 'Authorization' => "Bearer #{token_a}", 'Content-Type' => 'application/json' } }

  let!(:assessment_a) { Assessment.unscoped.create!(tenant_id: org_a.id, name: 'Export Assessment', created_by: user_a.id, time_limit_min: 30) }
  let!(:session_a) { Session.unscoped.create!(tenant_id: org_a.id, assessment_id: assessment_a.id, candidate_id: 880, status: 'ended') }
  let!(:portfolio_a) { session_a.create_portfolio!(candidate_id: session_a.candidate_id, generation_status: 'complete', generated_at: 1.hour.ago) }

  let!(:vacancy_a) { Vacancy.unscoped.create!(tenant_id: org_a.id, created_by: user_a.id, role_title: 'Engineer A', culture_dimensions: 'A', competency_expectations: 'A') }
  let!(:vacancy_b) { Vacancy.unscoped.create!(tenant_id: org_b.id, created_by: 1, role_title: 'Engineer B', culture_dimensions: 'B', competency_expectations: 'B') }

  before do
    portfolio_a.portfolio_skills.create!(
      skill_label: 'Skill A',
      ai_level: 4,
      ai_confidence: 'high',
      competency_summary: 'Summary A',
      evidence: ['Quote A']
    )
  end

  describe '7. JSON & PDF export with same-tenant vs foreign vs nonexistent vacancy' do
    it 'succeeds with 200 OK for same-tenant vacancy in JSON export' do
      get "/api/v1/portfolios/#{portfolio_a.id}/export?format=json&vacancy_id=#{vacancy_a.id}", headers: headers_a
      expect(response).to have_http_status(:ok)
    end

    it 'returns identical 404 for foreign and nonexistent vacancy in JSON export' do
      get "/api/v1/portfolios/#{portfolio_a.id}/export?format=json&vacancy_id=#{vacancy_b.id}", headers: headers_a
      foreign_body = response.body
      expect(response).to have_http_status(:not_found)

      get "/api/v1/portfolios/#{portfolio_a.id}/export?format=json&vacancy_id=999999", headers: headers_a
      nonexistent_body = response.body
      expect(response).to have_http_status(:not_found)

      expect(foreign_body).to eq(nonexistent_body)
    end

    it 'returns identical 404 for foreign and nonexistent vacancy in PDF export' do
      get "/api/v1/portfolios/#{portfolio_a.id}/export?format=pdf&vacancy_id=#{vacancy_b.id}", headers: headers_a
      expect(response).to have_http_status(:not_found)

      get "/api/v1/portfolios/#{portfolio_a.id}/export?format=pdf&vacancy_id=999999", headers: headers_a
      expect(response).to have_http_status(:not_found)
    end
  end
end
