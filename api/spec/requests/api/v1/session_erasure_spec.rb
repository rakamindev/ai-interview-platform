# frozen_string_literal: true

require 'rails_helper'

# UU PDP right-to-erasure: deleting a session must remove ALL personal data
# cascades — transcript, coverage maps, portfolio (skills, overrides,
# fit/gap reports).
RSpec.describe 'Api::V1::Sessions DELETE (data erasure)', type: :request do
  let(:user) { create(:user, :admin) }
  let(:headers) { auth_headers(user) }
  let!(:assessment) { create(:assessment, :with_skills, tenant_id: 1) }
  let!(:session) { create(:session, :ended, assessment: assessment) }

  before do
    with_tenant
    create(:transcript_turn, session: session, turn_number: 1, speaker: 'ai', text: 'Hello')
    create(:coverage_map, session: session)
    @portfolio = create(:portfolio, :complete, session: session)
    @skill = create(:portfolio_skill, portfolio: @portfolio)
    create(:assessor_override, portfolio_skill: @skill)
    vacancy = create(:vacancy, tenant_id: 1)
    create(:fit_gap_report, portfolio: @portfolio, vacancy: vacancy)
  end

  it 'deletes the session and every personal-data cascade' do
    expect {
      delete "/api/v1/sessions/#{session.id}", headers: headers
    }.to change(Session.unscoped, :count).by(-1)

    expect_json_response
    expect_keys(json_body, :message)

    expect(TranscriptTurn.unscoped.where(session_id: session.id)).to be_empty
    expect(CoverageMap.unscoped.where(session_id: session.id)).to be_empty
    expect(Portfolio.unscoped.exists?(@portfolio.id)).to be false
    expect(PortfolioSkill.unscoped.exists?(@skill.id)).to be false
    expect(FitGapReport.unscoped.where(portfolio_id: @portfolio.id)).to be_empty
  end

  it 'returns 404 for unknown sessions' do
    delete '/api/v1/sessions/99999', headers: headers

    expect_error(status: :not_found, message: 'Session not found')
  end

  it 'refuses to delete sessions that are not ended' do
    live = create(:session, :active, assessment: assessment)

    delete "/api/v1/sessions/#{live.id}", headers: headers

    expect_error(status: :unprocessable_entity, message: 'Only ended sessions can be deleted')
    expect(Session.unscoped.exists?(live.id)).to be true
  end
end
