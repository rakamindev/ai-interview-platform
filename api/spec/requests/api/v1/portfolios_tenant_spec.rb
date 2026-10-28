# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Portfolio Tenant Isolation (IDOR Protection)', type: :request do
  let!(:org_alpha) do
    Organization.create!(
      name: 'Alpha Corp',
      scheme: 'alpha-corp',
      identifier: 'alpha',
      host: 'alpha.example.com'
    )
  end

  let!(:org_beta) do
    Organization.create!(
      name: 'Beta Corp',
      scheme: 'beta-corp',
      identifier: 'beta',
      host: 'beta.example.com'
    )
  end

  let!(:user_alpha) do
    User.create!(
      email: 'assessor@alpha.com',
      password: 'password123',
      password_confirmation: 'password123',
      role: 'admin'
    )
  end

  let!(:token_alpha) do
    JsonWebToken.encode(user_id: user_alpha.id, role: 'admin', scheme: org_alpha.scheme)
  end

  let!(:user_beta) do
    User.create!(
      email: 'assessor@beta.com',
      password: 'password123',
      password_confirmation: 'password123',
      role: 'admin'
    )
  end

  let!(:assessment_beta) do
    Current.using(tenant_id: org_beta.id) do
      Assessment.create!(name: 'Beta Role', time_limit_min: 30, created_by: user_beta.id)
    end
  end

  let!(:session_beta) do
    Current.using(tenant_id: org_beta.id) do
      Session.create!(assessment: assessment_beta, candidate_name: 'Beta Candidate')
    end
  end

  let!(:portfolio_beta) do
    Portfolio.create!(
      session: session_beta,
      generation_status: 'complete'
    )
  end

  let!(:portfolio_skill_beta) do
    PortfolioSkill.create!(
      portfolio: portfolio_beta,
      skill_id: 'ruby',
      skill_label: 'Ruby on Rails',
      ai_level: 3,
      ai_confidence: 'high',
      competency_summary: 'Solid Rails knowledge'
    )
  end

  let!(:vacancy_beta) do
    Current.using(tenant_id: org_beta.id) do
      Vacancy.create!(role_title: 'Beta Backend Engineer', created_by: user_beta.id)
    end
  end

  describe 'Cross-Tenant Access Restrictions' do
    it 'denies Org Alpha assessor from viewing Org Beta session portfolio (returns 404)' do
      get "/api/v1/sessions/#{session_beta.id}/portfolio",
          headers: { 'Authorization' => "Bearer #{token_alpha}" }

      expect(response).to have_http_status(:not_found)
      json = JSON.parse(response.body)
      expect(json['error']).to match(/Session not found/i)
    end

    it 'denies Org Alpha assessor from exporting Org Beta portfolio (returns 404)' do
      get "/api/v1/portfolios/#{portfolio_beta.id}/export",
          headers: { 'Authorization' => "Bearer #{token_alpha}" }

      expect(response).to have_http_status(:not_found)
      json = JSON.parse(response.body)
      expect(json['error']).to match(/Portfolio not found/i)
    end

    it 'denies Org Alpha assessor from generating fit/gap on Org Beta portfolio (returns 404)' do
      post "/api/v1/portfolios/#{portfolio_beta.id}/fitgap",
           params: { vacancy_id: vacancy_beta.id },
           headers: { 'Authorization' => "Bearer #{token_alpha}" },
           as: :json

      expect(response).to have_http_status(:not_found)
      json = JSON.parse(response.body)
      expect(json['error']).to match(/Portfolio not found/i)
    end

    it 'denies Org Alpha assessor from regenerating fit/gap on Org Beta portfolio (returns 404)' do
      post "/api/v1/portfolios/#{portfolio_beta.id}/regenerate_fitgap",
           params: { vacancy_id: vacancy_beta.id },
           headers: { 'Authorization' => "Bearer #{token_alpha}" },
           as: :json

      expect(response).to have_http_status(:not_found)
      json = JSON.parse(response.body)
      expect(json['error']).to match(/Portfolio not found/i)
    end

    it 'denies Org Alpha assessor from viewing fit/gap report on Org Beta portfolio (returns 404)' do
      get "/api/v1/portfolios/#{portfolio_beta.id}/fitgap/#{vacancy_beta.id}",
          headers: { 'Authorization' => "Bearer #{token_alpha}" }

      expect(response).to have_http_status(:not_found)
      json = JSON.parse(response.body)
      expect(json['error']).to match(/Portfolio not found/i)
    end

    it 'denies Org Alpha assessor from overriding Org Beta portfolio skill (returns 404)' do
      post "/api/v1/portfolio_skills/#{portfolio_skill_beta.id}/override",
           params: { override: { override_level: 4, assessor_notes: 'Unauthorized edit' } },
           headers: { 'Authorization' => "Bearer #{token_alpha}" },
           as: :json

      expect(response).to have_http_status(:not_found)
      json = JSON.parse(response.body)
      expect(json['error']).to match(/Portfolio skill not found/i)
    end
  end
end
