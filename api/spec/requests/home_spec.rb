# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'The review desk', type: :request do
  let(:organization) { create(:organization) }
  let(:assessment) { create(:assessment, tenant_id: organization.id, name: 'Management Trainee', time_limit_min: 45) }
  let(:headers) { auth_headers(organization) }

  def interview(**attrs)
    create(:session, assessment: assessment, **attrs)
  end

  def desk(params = {})
    get '/api/v1/home', params: params, headers: headers
    JSON.parse(response.body)
  end

  it 'puts a failed interview first in Needs you, until the person is re-invited' do
    failed = interview(candidate_name: 'Sekar Arum', status: 'ended', end_reason: 'error', ended_at: 2.hours.ago)

    items = desk.dig('needs_you', 'data', 'items')
    expect(items.first).to include('type' => 'failed_interview', 'reference' => "R-#{failed.id}", 'turns' => 0)

    interview(candidate_name: 'sekar arum', status: 'pending', end_reason: nil)
    expect(desk.dig('summary', 'data', 'failed_needing_reinvite')).to eq(0)
  end

  it 'lists stuck reports that trying again can fix, but not an empty interview' do
    stuck = create(:portfolio, session: interview(status: 'ended', end_reason: 'all_covered'), generation_status: 'generating')
    stuck.update_column(:status_changed_at, 10.minutes.ago)
    create(:portfolio, session: interview(status: 'ended', end_reason: 'error'), generation_status: 'failed',
                       failure_kind: 'no_interview_data')

    items = desk.dig('needs_you', 'data', 'items').select { |i| i['type'] == 'stuck_report' }
    expect(items.map { |i| i['state'] }).to eq(['stalled'])
  end

  it 'lists recent results with their evidence statuses, but never a level or a quote' do
    report = create(:portfolio, session: interview(status: 'ended', end_reason: 'all_covered'),
                                generation_status: 'complete', generated_at: 1.hour.ago)
    create(:portfolio_skill, portfolio: report, status: 'thin_evidence', caveat: 'low_probe_count', ai_level: 3,
                             evidence: ['A private quote.'])
    create(:portfolio_skill, portfolio: report, status: 'not_assessed', ai_level: nil, ai_confidence: nil)

    body = desk
    expect(body.dig('results', 'data', 'items').first['skill_statuses']).to eq(%w[thin_evidence not_assessed])
    expect(body.dig('summary', 'data', 'needs_look_7d')).to eq(1)
    expect(response.body).not_to include('A private quote.', 'ai_level', 'ai_confidence')
  end

  it 'counts who is interviewing now, and leaves out a session stuck as live' do
    interview(status: 'active', started_at: 10.minutes.ago)
    interview(status: 'active', started_at: 3.hours.ago)

    expect(desk.dig('summary', 'data')).to include('live' => 1, 'stale_live' => 1)
  end

  it 'only counts new results when the page says when it last looked' do
    expect(desk.dig('summary', 'data')).not_to have_key('new_results')
    expect(desk(since: 1.day.ago.iso8601).dig('summary', 'data')).to include('new_results' => 0)
  end
end
