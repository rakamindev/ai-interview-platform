# frozen_string_literal: true

require 'rails_helper'

# F18: one interview can be compared against many vacancies. Rank them by how much of each
# vacancy the interview actually covered, so a recruiter doesn't read missing evidence from the
# wrong role as a weak candidate.
RSpec.describe 'Vacancy matches for a portfolio', type: :request do
  let(:org) { create(:organization) }
  let(:portfolio) do
    create(:portfolio, session: create(:session, assessment: create(:assessment, tenant_id: org.id)))
  end
  let(:headers) do
    { 'Authorization' => "Bearer #{JsonWebToken.encode({ user_id: 1, role: 'admin', scheme: org.scheme })}" }
  end

  def vacancy(title, skills, tenant: org)
    create(:vacancy, tenant_id: tenant.id, role_title: title).tap do |v|
      skills.each { |label, level| create(:vacancy_skill, vacancy: v, skill_label: label, expected_level: level) }
    end
  end

  before do
    create(:portfolio_skill, portfolio: portfolio, skill_label: 'SQL',        ai_level: 4)
    create(:portfolio_skill, portfolio: portfolio, skill_label: 'Ruby',       ai_level: 3)
    create(:portfolio_skill, portfolio: portfolio, skill_label: 'API Design', ai_level: 2)
  end

  # Same coverage: the smaller total shortfall (sum of levels below requirement) ranks first.
  it 'ranks vacancies by interview coverage, then by shortfall, with per-vacancy counts' do
    vacancy('Data Engineer',    { 'SQL' => 3, 'Spark' => 3, 'Airflow' => 3, 'Kafka' => 2 })
    vacancy('Backend Engineer', { 'SQL' => 3, 'Ruby' => 3, 'API Design' => 4 })
    vacancy('Rails Developer',  { 'Ruby' => 4, 'SQL' => 4, 'API Design' => 2 })
    vacancy('No skills yet',    {})

    get "/api/v1/portfolios/#{portfolio.id}/vacancy_matches", headers: headers

    expect(response).to have_http_status(:ok)
    matches = response.parsed_body['matches']
    expect(matches.map { |m| m['role_title'] }).to eq(['Rails Developer', 'Backend Engineer', 'Data Engineer', 'No skills yet'])
    expect(matches.first['summary']).to include('total' => 3, 'assessed' => 3, 'coverage_pct' => 100, 'match' => 2, 'gap' => 1)
    expect(matches.first['shortfall']).to eq(1)
    expect(matches.second['shortfall']).to eq(2)
    expect(matches[2]['summary']).to include('total' => 4, 'assessed' => 1, 'coverage_pct' => 25)
  end

  it "never lists another company's vacancies" do
    vacancy('Ours', { 'SQL' => 3 })
    vacancy('Theirs', { 'SQL' => 3 }, tenant: create(:organization))

    get "/api/v1/portfolios/#{portfolio.id}/vacancy_matches", headers: headers

    expect(response.parsed_body['matches'].map { |m| m['role_title'] }).to eq(['Ours'])
  end

  it "returns 404 for another company's portfolio" do
    other = create(:organization)
    other_headers = { 'Authorization' => "Bearer #{JsonWebToken.encode({ user_id: 2, role: 'admin', scheme: other.scheme })}" }

    get "/api/v1/portfolios/#{portfolio.id}/vacancy_matches", headers: other_headers

    expect(response).to have_http_status(:not_found)
  end
end
