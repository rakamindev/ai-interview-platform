# frozen_string_literal: true

require 'rails_helper'

# The assessment and candidate lists carry review information additively, so
# a failed portfolio no longer looks "Completed" (N15) and each row says what
# still needs a human (AC-104).
RSpec.describe 'Review information on the assessment and candidate lists' do
  let(:org)        { create(:organization) }
  let(:headers)    { auth_headers_for(org) }
  let(:assessment) { create(:assessment, organization: org) }

  def session_with(status: nil, low: 0, name: nil)
    session = create(:session, assessment: assessment, candidate_name: name || "Kandidat Contoh #{status}")
    return session unless status

    portfolio = create(:portfolio, session: session, generation_status: status,
                                   generated_at: status == 'complete' ? 1.day.ago : nil)
    low.times { create(:portfolio_skill, portfolio: portfolio, ai_confidence: 'low') }
    create(:portfolio_skill, portfolio: portfolio) if status == 'complete' && low.zero?
    session
  end

  def candidates
    get "/api/v1/assessments/#{assessment.id}/sessions", headers: headers
    expect(response).to have_http_status(:ok)
    response.parsed_body['sessions'].index_by { |s| s['id'] }
  end

  it 'gives each candidate a portfolio status and a review summary (AC-104, N15)' do
    pending_invite = create(:session, assessment: assessment, status: 'pending', started_at: nil, ended_at: nil)
    generating = session_with(status: 'generating')
    failed = session_with(status: 'failed')
    ready_open = session_with(status: 'complete', low: 3)
    reviewed = session_with(status: 'complete')

    rows = candidates

    expect(rows[pending_invite.id]).to include('portfolio_status' => 'none', 'review_summary' => [])
    expect(rows[generating.id]).to include('portfolio_status' => 'generating', 'review_summary' => [])
    expect(rows[failed.id]).to include('portfolio_status' => 'failed',
                                       'review_summary' => [{ 'code' => 'generation_failed', 'count' => 1 }])
    expect(rows[ready_open.id]).to include('portfolio_status' => 'ready',
                                           'review_summary' => [{ 'code' => 'unreviewed_low_confidence', 'count' => 3 }])
    expect(rows[reviewed.id]).to include('portfolio_status' => 'ready', 'review_summary' => [])
  end

  it 'keeps the existing candidate fields' do
    session = session_with(status: 'complete')

    expect(candidates[session.id].keys).to include('id', 'candidate_name', 'status', 'end_reason', 'started_at',
                                                    'invite_url', 'created_at')
  end

  it 'clears the review summary once the assessor confirms the skill' do
    session = session_with(status: 'complete', low: 1)
    skill = session.portfolio.portfolio_skills.first
    PortfolioSkills::OverrideActions.new(skill, actor_id: 1).confirm(notes: 'Contoh catatan konfirmasi.')

    expect(candidates[session.id]['review_summary']).to eq([])
  end

  it 'counts candidates and candidates that need review per assessment (AC-104)' do
    session_with(status: 'complete', low: 1)
    session_with(status: 'failed')
    session_with(status: 'complete')
    create(:session, assessment: assessment, status: 'pending', started_at: nil, ended_at: nil)
    other = create(:assessment, organization: org, name: 'Contoh Assessment Kosong')

    get '/api/v1/assessments', headers: headers

    rows = response.parsed_body['assessments'].index_by { |a| a['id'] }
    expect(rows[assessment.id]).to include('candidate_count' => 4, 'needs_review_count' => 2)
    expect(rows[other.id]).to include('candidate_count' => 0, 'needs_review_count' => 0)
    expect(rows[assessment.id].keys).to include('name', 'time_limit_min', 'language', 'latest_session')
  end
end
