# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Api::V1::Portfolios', type: :request do
  let!(:tenant_a) do
    Organization.find_by(scheme: 'tenant_a') || Organization.create!(
      name: 'Tenant Alpha',
      scheme: 'tenant_a',
      identifier: 'tenant-a-111',
      host: 'alpha.rakamin.com'
    )
  end

  let!(:tenant_b) do
    Organization.find_by(scheme: 'tenant_b') || Organization.create!(
      name: 'Tenant Beta',
      scheme: 'tenant_b',
      identifier: 'tenant-b-222',
      host: 'beta.rakamin.com'
    )
  end

  let(:assessor_a_token) do
    JsonWebToken.encode(user_id: 10, role: 'assessor', scheme: tenant_a.scheme)
  end

  let(:assessor_b_token) do
    JsonWebToken.encode(user_id: 20, role: 'assessor', scheme: tenant_b.scheme)
  end

  let(:headers_a) do
    {
      'Authorization' => "Bearer #{assessor_a_token}",
      'Content-Type'  => 'application/json'
    }
  end

  let(:headers_b) do
    {
      'Authorization' => "Bearer #{assessor_b_token}",
      'Content-Type'  => 'application/json'
    }
  end

  let!(:assessment_a) do
    Current.organization = tenant_a
    Current.tenant_id = tenant_a.id
    Assessment.create!(
      name: 'Alpha Engineering Assessment',
      time_limit_min: 45,
      tenant_id: tenant_a.id,
      created_by: 10
    )
  ensure
    Current.clear
  end

  let!(:session_a) do
    Current.organization = tenant_a
    Current.tenant_id = tenant_a.id
    assessment_a.sessions.create!(
      tenant_id: tenant_a.id,
      candidate_id: 101,
      candidate_name: 'Alpha Candidate',
      status: 'ended'
    )
  ensure
    Current.clear
  end

  let!(:portfolio_a) do
    Current.organization = tenant_a
    Current.tenant_id = tenant_a.id
    Portfolio.create!(
      session_id: session_a.id,
      tenant_id: tenant_a.id,
      candidate_id: 101,
      generation_status: 'complete',
      generated_at: Time.current
    )
  ensure
    Current.clear
  end

  describe 'GET /api/v1/sessions/:id/portfolio (Finding F-1: Multi-tenant portfolio isolation)' do
    it 'allows assessor from same tenant (Tenant A) to view the candidate portfolio' do
      get "/api/v1/sessions/#{session_a.id}/portfolio", headers: headers_a

      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)
      expect(json['portfolio']['id']).to eq(portfolio_a.id)
      expect(json['portfolio']['candidate_name']).to eq('Alpha Candidate')
    end

    it 'strictly prevents assessor or candidate from another tenant (Tenant B) from accessing Tenant A portfolio' do
      get "/api/v1/sessions/#{session_a.id}/portfolio", headers: headers_b

      # Scoped to Tenant B, session from Tenant A is not found
      expect(response).to have_http_status(:not_found)
    end
  end

  describe 'GET /api/v1/portfolios/:id/export (PDF Export with UTF-8 & Overrides)' do
    let!(:vacancy) do
      Current.organization = tenant_a
      Current.tenant_id = tenant_a.id
      Vacancy.create!(
        role_title: 'Backend Engineer',
        tenant_id: tenant_a.id,
        created_by: 10
      )
    ensure
      Current.clear
    end

    let!(:portfolio_skill) do
      Current.organization = tenant_a
      Current.tenant_id = tenant_a.id
      skill = portfolio_a.portfolio_skills.create!(
        skill_label: 'Ruby on Rails',
        is_discovered: false,
        ai_level: 2,
        ai_confidence: 'high',
        competency_summary: 'Solid understanding of Rails conventions & MVC pattern',
        evidence: ['Candidate demonstrated deep grasp of ActiveRecord and multi-tenancy'],
        tenant_id: tenant_a.id
      )
      # Assessor override that introduces the unicode arrow '→' in level_text
      skill.create_assessor_override!(
        ai_level: 2,
        override_level: 3,
        overridden_by: 10,
        assessor_notes: 'Strong practical experience with production Rails architectures'
      )
      skill
    ensure
      Current.clear
    end

    let!(:fit_gap_report) do
      Current.organization = tenant_a
      Current.tenant_id = tenant_a.id
      FitGapReport.create!(
        portfolio_id: portfolio_a.id,
        vacancy_id: vacancy.id,
        tenant_id: tenant_a.id,
        skill_comparisons: [
          {
            'skill_label' => 'Ruby on Rails',
            'expected_level' => 3,
            'candidate_level' => 3,
            'result' => 'match',
            'delta' => 0
          }
        ],
        culture_narrative: 'Candidate showed strong alignment with team culture — communicative & proactive.',
        overall_narrative: 'Recommended for next interview stage.'
      )
    ensure
      Current.clear
    end

    it 'exports PDF successfully without UTF-8 encoding errors even with assessor overrides and unicode characters' do
      get "/api/v1/portfolios/#{portfolio_a.id}/export?format=pdf&vacancy_id=#{vacancy.id}", headers: headers_a

      expect(response).to have_http_status(:ok)
      expect(response.content_type).to eq('application/pdf')
      expect(response.body).to start_with('%PDF')
    end
  end
end
