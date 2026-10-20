# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Portfolio export', type: :request do
  let(:org)       { build_org }
  let(:portfolio) { build_portfolio(build_session(org)) }
  let(:vacancy)   { build_vacancy(org, skills: { 'React' => 3, 'SQL' => 3 }) }

  before do
    skill = add_portfolio_skill(portfolio, label: 'React', level: 2)
    skill.update!(evidence: ["I ship fast \u{1F680} and care about users – always"])
    AssessorOverride.create!(portfolio_skill: skill, ai_level: 2, override_level: 3, overridden_by: 42,
                             assessor_notes: "Checked in a call → confirmed")
    FitGap::Engine.new(portfolio: portfolio, vacancy: vacancy).refresh_comparisons!
  end

  it 'renders a PDF even when free text contains characters outside Windows-1252 (regression: it used to 500)' do
    get "/api/v1/portfolios/#{portfolio.id}/export", params: { format: 'pdf', vacancy_id: vacancy.id },
                                                    headers: auth_headers(org)

    expect(response).to have_http_status(:ok)
    expect(response.media_type).to eq('application/pdf')
    expect(response.body.byteslice(0, 4)).to eq('%PDF')
  end

  it 'exports JSON including the fit/gap summary and narrative status' do
    get "/api/v1/portfolios/#{portfolio.id}/export", params: { format: 'json', vacancy_id: vacancy.id },
                                                    headers: auth_headers(org)

    report = JSON.parse(response.body)['fit_gap_report']
    expect(report['summary']).to include('total' => 2, 'assessed' => 1)
    expect(report['narrative_status']).to eq('pending')
  end

  it 'refuses an unsupported format and a portfolio that is not complete' do
    get "/api/v1/portfolios/#{portfolio.id}/export", params: { format: 'xml' }, headers: auth_headers(org)
    expect(response).to have_http_status(:unprocessable_entity)

    portfolio.update!(generation_status: 'failed')
    get "/api/v1/portfolios/#{portfolio.id}/export", params: { format: 'json' }, headers: auth_headers(org)
    expect(response).to have_http_status(:unprocessable_entity)
  end

  describe Exports::PdfGenerator do
    it 'degrades unsupported characters instead of raising' do
      expect(described_class.pdf_safe("a → b \u{1F680} é")).to eq("a -> b ? é")
    end

    it 'tolerates nil' do
      expect(described_class.pdf_safe(nil)).to eq('')
    end
  end
end
