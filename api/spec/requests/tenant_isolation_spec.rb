# frozen_string_literal: true

require 'rails_helper'
require 'sidekiq/testing'

# F1: portfolios, portfolio skills and fit/gap reports have no tenant_id of their own, so every
# lookup by id must go through a session the caller's company owns. An assessor of company B
# guessing ids of company A must get 404 and change nothing.
RSpec.describe 'Tenant isolation for candidate results', type: :request do
  let(:company_a) { create(:organization) }
  let(:company_b) { create(:organization) }

  let(:portfolio_a) do
    create(:portfolio, session: create(:session, assessment: create(:assessment, tenant_id: company_a.id)))
  end
  let(:skill_a)   { create(:portfolio_skill, portfolio: portfolio_a, ai_level: 2) }
  let(:vacancy_a) { create(:vacancy, tenant_id: company_a.id) }
  let(:vacancy_b) { create(:vacancy, tenant_id: company_b.id) }

  def auth_for(org)
    { 'Authorization' => "Bearer #{JsonWebToken.encode({ user_id: 9, role: 'admin', scheme: org.scheme })}" }
  end

  around { |example| Sidekiq::Testing.fake! { example.run } }
  before do
    FitGapGeneratorWorker.clear
    FitGapReport.create!(portfolio: portfolio_a, vacancy: vacancy_a, status: 'ready',
                         skill_comparisons: [{ 'skill_label' => 'SQL', 'result' => 'gap' }], overall_narrative: 'Secret')
  end

  context 'as an assessor of another company' do
    let(:headers) { auth_for(company_b) }

    it 'cannot read the fit/gap report' do
      get "/api/v1/portfolios/#{portfolio_a.id}/fitgap/#{vacancy_a.id}", headers: headers

      expect(response).to have_http_status(:not_found)
      expect(response.body).not_to include('Secret')
    end

    it 'cannot trigger or regenerate a report on it, even against its own vacancy' do
      post "/api/v1/portfolios/#{portfolio_a.id}/fitgap", params: { fitgap: { vacancy_id: vacancy_b.id } },
                                                          headers: headers, as: :json
      expect(response).to have_http_status(:not_found)

      post "/api/v1/portfolios/#{portfolio_a.id}/regenerate_fitgap", params: { vacancy_id: vacancy_b.id },
                                                                     headers: headers, as: :json
      expect(response).to have_http_status(:not_found)
      expect(FitGapGeneratorWorker.jobs).to be_empty
    end

    it 'cannot export the candidate portfolio' do
      get "/api/v1/portfolios/#{portfolio_a.id}/export", params: { format: 'json' }, headers: headers

      expect(response).to have_http_status(:not_found)
    end

    it "cannot override the candidate's skill level" do
      post "/api/v1/portfolio_skills/#{skill_a.id}/override",
           params: { override: { override_level: 5 } }, headers: headers, as: :json

      expect(response).to have_http_status(:not_found)
      expect(skill_a.reload.assessor_override).to be_nil
    end
  end

  context 'as an assessor of the owning company' do
    let(:headers) { auth_for(company_a) }

    it 'still reads its own report' do
      get "/api/v1/portfolios/#{portfolio_a.id}/fitgap/#{vacancy_a.id}", headers: headers

      expect(response).to have_http_status(:ok)
    end

    it 'still overrides its own candidate' do
      post "/api/v1/portfolio_skills/#{skill_a.id}/override",
           params: { override: { override_level: 4 } }, headers: headers, as: :json

      expect(response).to have_http_status(:created)
    end
  end
end
