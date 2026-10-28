# frozen_string_literal: true

require 'rails_helper'

# GET /api/v1/review_queue lists the portfolios that still need a human, so
# AI ratings do not pass unreviewed (UU PDP Pasal 10). Oldest first, never by
# a score (AC-102, AC-103).
RSpec.describe 'GET /api/v1/review_queue' do
  let(:org_a)      { create(:organization) }
  let(:org_b)      { create(:organization) }
  let(:assessment) { create(:assessment, organization: org_a, name: 'Contoh Assessment Backend') }
  let(:headers)    { auth_headers_for(org_a) }

  def portfolio_with(reason, generated_at:, assessment: self.assessment, name: nil)
    session = create(:session, assessment: assessment, candidate_name: name || "Kandidat Contoh #{reason}")
    portfolio = create(:portfolio, session: session, generated_at: generated_at)
    case reason
    when :low then create(:portfolio_skill, portfolio: portfolio, ai_confidence: 'low')
    when :missing
      create(:portfolio_skill, portfolio: portfolio, ai_level: nil, ai_confidence: nil,
                               rating_status: 'not_assessed', not_assessed_reason: 'not_covered')
    when :legacy
      create(:portfolio_skill, portfolio: portfolio)
      portfolio.update!(ratings_validated: false)
    when :empty then nil
    when :failed then portfolio.update!(generation_status: 'failed', generated_at: nil)
    when :none then create(:portfolio_skill, portfolio: portfolio)
    end
    portfolio
  end

  def queue(params = {})
    get '/api/v1/review_queue', params: params, headers: headers
    expect(response).to have_http_status(:ok)
    response.parsed_body
  end

  it 'lists only portfolios that need review, with their reasons, oldest first (AC-103)' do
    newer = portfolio_with(:low, generated_at: 1.day.ago)
    older = portfolio_with(:missing, generated_at: 3.days.ago)
    portfolio_with(:none, generated_at: 5.days.ago)

    body = queue

    expect(body['items'].pluck('portfolio_id')).to eq([older.id, newer.id])
    first = body['items'].first
    expect(first).to include('session_id' => older.session_id, 'assessment_id' => assessment.id,
                             'assessment_name' => 'Contoh Assessment Backend',
                             'candidate_name' => 'Kandidat Contoh missing',
                             'reasons' => [{ 'code' => 'unreviewed_not_assessed', 'count' => 1 }],
                             'target' => { 'page' => 'portfolio', 'vacancy_id' => nil })
    expect(Time.zone.parse(first['waiting_since'])).to be_within(1.second).of(older.generated_at)
  end

  it 'summarises the number of items per reason' do
    portfolio_with(:low, generated_at: 1.day.ago)
    portfolio_with(:low, generated_at: 2.days.ago)
    portfolio_with(:legacy, generated_at: 3.days.ago)
    portfolio_with(:failed, generated_at: 4.days.ago)

    expect(queue['summary']).to eq(
      'unreviewed_low_confidence' => 2, 'unreviewed_not_assessed' => 0, 'narrative_failed' => 0,
      'narrative_outdated' => 0, 'legacy_ratings' => 1, 'generation_failed' => 1, 'empty_portfolio' => 0,
      'portfolios' => 4
    )
  end

  it 'lists a complete portfolio without any skill, linked to the portfolio (AC-101)' do
    empty = portfolio_with(:empty, generated_at: 1.day.ago)

    body = queue(reason: 'portfolio')

    expect(body['items'].pluck('portfolio_id')).to eq([empty.id])
    expect(body['items'].first).to include('reasons' => [{ 'code' => 'empty_portfolio', 'count' => 1 }],
                                           'target' => { 'page' => 'portfolio', 'vacancy_id' => nil })
    expect(body['summary']['empty_portfolio']).to eq(1)
  end

  it 'filters by a reason group but keeps the full summary' do
    portfolio_with(:low, generated_at: 1.day.ago)
    legacy = portfolio_with(:legacy, generated_at: 2.days.ago)

    body = queue(reason: 'legacy')

    expect(body['items'].pluck('portfolio_id')).to eq([legacy.id])
    expect(body['summary']['portfolios']).to eq(2)
  end

  it 'rejects an unknown reason group' do
    get '/api/v1/review_queue', params: { reason: 'skor' }, headers: headers

    expect(response).to have_http_status(:unprocessable_entity)
  end

  it 'never shows another organisation (AC-102)' do
    mine = portfolio_with(:low, generated_at: 1.day.ago)
    portfolio_with(:low, generated_at: 2.days.ago, assessment: create(:assessment, organization: org_b),
                         name: 'Kandidat Contoh Org B')

    body = queue

    expect(body['items'].pluck('portfolio_id')).to eq([mine.id])
    expect(body['summary']['portfolios']).to eq(1)
    expect(response.body).not_to include('Kandidat Contoh Org B')
  end

  it 'returns 50 items per page with page metadata' do
    51.times { |i| portfolio_with(:low, generated_at: (60 - i).hours.ago) }

    first_page = queue
    second_page = queue(page: 2)

    expect(first_page['items'].size).to eq(50)
    expect(first_page['meta']).to include('current_page' => 1, 'total_pages' => 2, 'total_count' => 51, 'per_page' => 50)
    expect(second_page['items'].size).to eq(1)
  end

  it 'uses the same number of queries for 5 or 25 portfolios (no N+1)' do
    count_queries = lambda do
      count = 0
      callback = ->(*, payload) { count += 1 unless payload[:name].in?(%w[SCHEMA TRANSACTION]) || payload[:cached] }
      ActiveSupport::Notifications.subscribed(callback, 'sql.active_record') { queue }
      count
    end

    5.times { |i| portfolio_with(:low, generated_at: (i + 1).hours.ago) }
    with_five = count_queries.call
    20.times { |i| portfolio_with(:missing, generated_at: (i + 10).hours.ago) }

    expect(count_queries.call).to eq(with_five)
  end

  # Without a token the tenant cannot be resolved; the app answers 403 for
  # that on every endpoint (TenantNotFound), and no queue data is returned.
  it 'returns nothing without a token' do
    portfolio_with(:low, generated_at: 1.day.ago)

    get '/api/v1/review_queue'

    expect(response).to have_http_status(:forbidden)
    expect(response.body).not_to include('Kandidat Contoh')
  end
end
