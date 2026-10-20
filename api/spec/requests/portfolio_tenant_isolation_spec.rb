# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Portfolio tenant isolation', type: :request do
  let(:own_org)   { create(:organization) }
  let(:other_org) { create(:organization) }

  let(:other_session)   { create(:session, assessment: create(:assessment, organization: other_org)) }
  let(:other_portfolio) { create(:portfolio, session: other_session) }
  let(:other_skill)     { create(:portfolio_skill, portfolio: other_portfolio, ai_level: 2) }
  let(:other_vacancy)   { create(:vacancy, organization: other_org) }
  let(:own_vacancy)     { create(:vacancy, organization: own_org) }

  let(:headers) { auth_headers(own_org) }

  it 'does not export another tenant portfolio' do
    get "/api/v1/portfolios/#{other_portfolio.id}/export", params: { format: 'json' }, headers: headers

    expect(response).to have_http_status(:not_found)
  end

  it 'does not let an assessor override another tenant skill rating' do
    post "/api/v1/portfolio_skills/#{other_skill.id}/override",
         params: { override: { override_level: 5 } }, headers: headers

    expect(response).to have_http_status(:not_found)
    expect(other_skill.reload.assessor_override).to be_nil
  end

  it 'does not queue a fit/gap report for another tenant portfolio' do
    post "/api/v1/portfolios/#{other_portfolio.id}/fitgap",
         params: { vacancy_id: own_vacancy.id }, headers: headers

    expect(response).to have_http_status(:not_found)
    expect(FitGapGeneratorWorker.jobs).to be_empty
  end

  it 'does not show another tenant fit/gap report' do
    FitGapReport.create!(portfolio: other_portfolio, vacancy: other_vacancy, skill_comparisons: [{ result: 'gap' }])

    get "/api/v1/portfolios/#{other_portfolio.id}/fitgap/#{other_vacancy.id}", headers: headers

    expect(response).to have_http_status(:not_found)
  end

  it 'does not regenerate another tenant fit/gap report' do
    report = FitGapReport.create!(portfolio: other_portfolio, vacancy: other_vacancy, skill_comparisons: [{ result: 'gap' }])

    post "/api/v1/portfolios/#{other_portfolio.id}/regenerate_fitgap",
         params: { vacancy_id: own_vacancy.id }, headers: headers

    expect(response).to have_http_status(:not_found)
    expect(FitGapReport.exists?(report.id)).to be(true)
  end

  context 'with a portfolio from the same tenant' do
    let(:own_session)   { create(:session, assessment: create(:assessment, organization: own_org)) }
    let(:own_portfolio) { create(:portfolio, session: own_session) }
    let(:own_skill)     { create(:portfolio_skill, portfolio: own_portfolio, ai_level: 2) }

    it 'exports it' do
      get "/api/v1/portfolios/#{own_portfolio.id}/export", params: { format: 'json' }, headers: headers

      expect(response).to have_http_status(:ok)
      expect(JSON.parse(response.body).dig('portfolio', 'id')).to eq(own_portfolio.id)
    end

    it 'saves an override' do
      post "/api/v1/portfolio_skills/#{own_skill.id}/override",
           params: { override: { override_level: 4, assessor_notes: 'Strong system design follow-up' } }, headers: headers

      expect(response).to have_http_status(:created)
      expect(own_skill.reload.assessor_override.override_level).to eq(4)
    end
  end
end
