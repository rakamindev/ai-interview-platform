# frozen_string_literal: true

require 'rails_helper'

# Match ranking: candidates with complete portfolios are scored against a
# vacancy's required skills (rule-based, no LLM call):
#   match +1.0 · exceed +0.75 · gap +0.25 · not assessed 0, averaged and
#   normalized to a percentage.
RSpec.describe 'Vacancy match ranking', type: :request do
  let!(:org) { create(:organization, scheme: 'test-corp', identifier: 'test-corp', name: 'Test Corp', host: 'localhost') }
  let(:token) { JsonWebToken.encode({ user_id: 1, role: 'admin', scheme: 'test-corp' }) }
  let(:auth) { { 'Authorization' => "Bearer #{token}" } }

  let!(:assessment) { create(:assessment, tenant_id: org.id, name: 'Engineer') }
  let!(:vacancy) { create(:vacancy, tenant_id: org.id, role_title: 'Senior Engineer') }
  let!(:ruby_req) { create(:vacancy_skill, vacancy: vacancy, skill_label: 'Ruby', expected_level: 3) }
  let!(:sql_req)  { create(:vacancy_skill, vacancy: vacancy, skill_label: 'SQL', expected_level: 2) }

  # Candidate A: Ruby L3 (match) + SQL L4 (exceed) -> (1.0 + 0.75) / 2 = 87.5
  let!(:session_a) { create(:session, tenant_id: org.id, assessment: assessment, candidate_name: 'Alice', status: 'ended', end_reason: 'all_covered') }
  let!(:portfolio_a) { create(:portfolio, session: session_a, generation_status: 'complete') }
  let!(:a_ruby) { create(:portfolio_skill, portfolio: portfolio_a, skill_label: 'Ruby', ai_level: 3) }
  let!(:a_sql)  { create(:portfolio_skill, portfolio: portfolio_a, skill_label: 'SQL', ai_level: 4) }

  # Candidate B: Ruby L1 (gap) + SQL L2 (match) -> (0.25 + 1.0) / 2 = 62.5
  let!(:session_b) { create(:session, tenant_id: org.id, assessment: assessment, candidate_name: 'Bob', status: 'ended', end_reason: 'all_covered') }
  let!(:portfolio_b) { create(:portfolio, session: session_b, generation_status: 'complete') }
  let!(:b_ruby) { create(:portfolio_skill, portfolio: portfolio_b, skill_label: 'Ruby', ai_level: 1) }
  let!(:b_sql)  { create(:portfolio_skill, portfolio: portfolio_b, skill_label: 'SQL', ai_level: 2) }

  # Candidate C: portfolio still generating -> must be excluded.
  let!(:session_c) { create(:session, tenant_id: org.id, assessment: assessment, candidate_name: 'Carol', status: 'active') }
  let!(:portfolio_c) { create(:portfolio, session: session_c, generation_status: 'generating') }

  it 'ranks candidates by fit score, highest first, excluding incomplete portfolios' do
    get "/api/v1/vacancies/#{vacancy.id}/matches", headers: auth

    expect(response).to have_http_status(:ok)
    matches = JSON.parse(response.body)['matches']
    expect(matches.map { |m| m['candidate_name'] }).to eq(%w[Alice Bob])
    expect(matches.first['score']).to eq(88)
    expect(matches.last['score']).to eq(63)
  end

  it 'includes per-skill breakdown' do
    get "/api/v1/vacancies/#{vacancy.id}/matches", headers: auth

    skills = JSON.parse(response.body)['matches'].first['skills']
    ruby = skills.find { |s| s['skill_label'] == 'Ruby' }
    expect(ruby['result']).to eq('match')
    expect(ruby['candidate_level']).to eq(3)
    expect(ruby['expected_level']).to eq(3)
  end

  it 'updates candidate ranking when an assessor override is applied' do
    # Override Bob's Ruby from L1 to L3 (match), raising Bob's score from 63% to 100%
    create(:assessor_override, portfolio_skill: b_ruby, ai_level: 1, override_level: 3, overridden_by: 1)

    get "/api/v1/vacancies/#{vacancy.id}/matches", headers: auth

    expect(response).to have_http_status(:ok)
    matches = JSON.parse(response.body)['matches']
    expect(matches.map { |m| m['candidate_name'] }).to eq(%w[Bob Alice])
    expect(matches.first['score']).to eq(100)
    expect(matches.first['skills'].find { |s| s['skill_label'] == 'Ruby' }['is_override']).to eq(true)
  end
end
