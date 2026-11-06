# frozen_string_literal: true

require 'rails_helper'

# W10: observed locally on 2026-11-06. A portfolio job from an older request failed, was retried by
# Sidekiq, and finished *after* a newer regeneration had completed, silently replacing the newer result.
# These specs drive both jobs by hand so the order is deterministic.
RSpec.describe 'Portfolio generation lifecycle', type: :request do
  let(:org)        { create_org }
  let(:assessment) { create_assessment(org: org) }
  let(:session)    { create_interviewed_session(org: org, assessment: assessment) }

  let(:quote_a) { 'For a live feed, context gets painful fast because every update re-renders every consumer.' }
  let(:quote_b) { 'I moved the feed into a store so components subscribe to just the slice they need.' }
  let(:transient_error) { Gemini::HttpClient::ApiError.new('API returned 503', status: 503) }

  def current_skills
    session.reload.portfolio.portfolio_skills.reload
  end

  # Request A: the session ends and the first portfolio job is enqueued. Its first attempt fails.
  def request_a_and_fail_first_attempt
    Sessions::EndHandler.new(session).call(reason: 'all_covered')
    args_a = last_enqueued_args(PortfolioGeneratorWorker)
    stub_gemini(transient_error)
    expect { run_job(PortfolioGeneratorWorker, args_a) }.to raise_error(Gemini::HttpClient::ApiError)
    args_a
  end

  # Request B: the assessor asks for a regeneration, and that job succeeds.
  def request_b_and_succeed
    post "/api/v1/sessions/#{session.id}/portfolio/regenerate", headers: auth_headers(org)
    expect(response).to have_http_status(:ok)
    args_b = last_enqueued_args(PortfolioGeneratorWorker)
    stub_gemini(model_output(level: 3, quote: quote_b))
    run_job(PortfolioGeneratorWorker, args_b)
    args_b
  end

  it 'does not let a late retry of an older request replace a newer completed result (W10)' do
    args_a = request_a_and_fail_first_attempt
    request_b_and_succeed

    expect(current_skills.map(&:ai_level)).to eq([3])
    expect(current_skills.first.evidence).to eq([quote_b])

    # Sidekiq now retries request A's job. Its (stale) output must not become the current result.
    stub_gemini(model_output(level: 1, quote: quote_a))
    run_job(PortfolioGeneratorWorker, args_a)

    expect(current_skills.map(&:ai_level)).to eq([3])
    expect(current_skills.first.evidence).to eq([quote_b])
  end

  it 'keeps the assessor override when a late retry runs after it was saved (D4 via W10)' do
    args_a = request_a_and_fail_first_attempt
    request_b_and_succeed

    skill = current_skills.first
    post "/api/v1/portfolio_skills/#{skill.id}/override",
         params: { override: { override_level: 4, assessor_notes: 'Stronger than rated' } },
         headers: auth_headers(org)
    expect(response).to have_http_status(:created)

    stub_gemini(model_output(level: 1, quote: quote_a))
    run_job(PortfolioGeneratorWorker, args_a)

    overrides = AssessorOverride.joins(portfolio_skill: :portfolio).where(portfolios: { session_id: session.id })
    expect(overrides.count).to eq(1)
    expect(overrides.first.override_level).to eq(4)
  end
end
