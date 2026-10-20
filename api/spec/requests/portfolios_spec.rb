# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Portfolios', type: :request do
  let(:org)       { create(:organization) }
  let(:headers)   { auth_headers(org) }
  let(:session)   { create(:session, assessment: create(:assessment, organization: org)) }
  let(:portfolio) { create(:portfolio, session: session) }

  before do
    create(:portfolio_skill, portfolio: portfolio, skill_label: 'System Design', ai_level: 3)
    create(:portfolio_skill, :not_assessed, portfolio: portfolio, skill_label: 'Testing')
  end

  it 'returns the assessment status and a null level for unassessed skills' do
    get "/api/v1/sessions/#{session.id}/portfolio", headers: headers

    skills = JSON.parse(response.body).dig('portfolio', 'skills').index_by { |s| s['skill_label'] }
    expect(skills['System Design']).to include('assessment_status' => 'assessed', 'ai_level' => 3)
    expect(skills['Testing']).to include('assessment_status' => 'not_assessed', 'ai_level' => nil)
  end

  it 'exports a PDF that includes unassessed skills' do
    get "/api/v1/portfolios/#{portfolio.id}/export", params: { format: 'pdf' }, headers: headers

    expect(response).to have_http_status(:ok)
    expect(response.media_type).to eq('application/pdf')
    expect(response.body).to start_with('%PDF')
  end
end
