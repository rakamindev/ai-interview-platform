# frozen_string_literal: true

require 'rails_helper'

# G3 (human authority): a successful new AI generation must never silently erase, change or
# misrepresent an assessor's earlier decision. New generations here come from the (future)
# administrative re-score path, because assessors cannot regenerate a finished report (D-14).
RSpec.describe 'Assessor overrides across generations (G3)', type: :request do
  let(:org)        { create_org }
  let(:assessment) { create_assessment(org: org) }
  let(:session)    { create_interviewed_session(org: org, assessment: assessment) }
  let(:quote)      { 'I moved the feed into a store so components subscribe to just the slice they need.' }

  def portfolio = session.reload.portfolio
  def current_skill = portfolio.portfolio_skills.first

  def publish_first_generation(level: 3)
    Sessions::EndHandler.new(session).call(reason: 'all_covered')
    stub_gemini(model_output(level: level, quote: quote))
    run_job(PortfolioGeneratorWorker, last_enqueued_args(PortfolioGeneratorWorker))
  end

  def save_override(skill, level:, notes: 'Assessor judgement')
    post "/api/v1/portfolio_skills/#{skill.id}/override",
         params: { override: { override_level: level, assessor_notes: notes } }, headers: auth_headers(org)
  end

  def rescore_with(output)
    generation = Portfolios::RequestGeneration.new(portfolio: portfolio, source: 'admin_rescore', enqueue: false).call
    stub_gemini(output)
    run_job(PortfolioGeneratorWorker, [session.id, generation.id])
    generation
  end

  def the_override = AssessorOverride.joins(portfolio_skill: :portfolio).find_by(portfolios: { id: portfolio.id })
  def the_override_with_level(level) = AssessorOverride.joins(portfolio_skill: :portfolio)
                                                      .find_by(portfolios: { id: portfolio.id }, override_level: level)

  before do
    publish_first_generation(level: 3)
    save_override(current_skill, level: 4)
    expect(response).to have_http_status(:created)
  end

  it 'carries the override forward to the matching skill when the AI level is unchanged' do
    rescore_with(model_output(level: 3, quote: quote))

    expect(the_override.portfolio_skill_id).to eq(current_skill.id)
    expect(the_override).to have_attributes(override_level: 4, needs_review: false)
  end

  it 'keeps the human level but flags it for review when the AI level changed' do
    rescore_with(model_output(level: 2, quote: quote))

    expect(the_override.portfolio_skill_id).to eq(current_skill.id)
    expect(the_override).to have_attributes(override_level: 4, needs_review: true, review_reason: 'ai_level_changed')
  end

  it 'keeps an override whose skill disappeared, flagged, and never attaches it to a similar-looking skill' do
    rescore_with(model_output(level: 3, quote: quote, label: 'React / Frontend Development'))

    expect(current_skill.skill_label).to eq('React / Frontend Development')
    expect(the_override.portfolio_skill.generation_id).to eq(portfolio.generations.first.id)
    expect(the_override).to have_attributes(override_level: 4, needs_review: true,
                                            review_reason: 'skill_missing_in_current')

    get "/api/v1/sessions/#{session.id}/portfolio", headers: auth_headers(org)
    listed = JSON.parse(response.body).dig('portfolio', 'overrides').sole
    expect(listed).to include('override_level' => 4, 'needs_review' => true, 'orphaned' => true)
  end

  it 'clears the review flag when the assessor saves the override again, recording the new AI level' do
    rescore_with(model_output(level: 2, quote: quote))
    save_override(current_skill, level: 4, notes: 'Still L4 after re-score')

    expect(response).to have_http_status(:ok)
    expect(the_override).to have_attributes(needs_review: false, review_reason: nil, ai_level: 2, override_level: 4)
  end

  it 'applies a save made from a stale screen to the current skill, without a second override' do
    old_skill_id = current_skill.id
    rescore_with(model_output(level: 2, quote: quote))

    save_override(PortfolioSkill.find(old_skill_id), level: 5, notes: 'Saved from an old tab')

    expect(response).to have_http_status(:ok)
    overrides = AssessorOverride.joins(portfolio_skill: :portfolio).where(portfolios: { id: portfolio.id })
    expect(overrides.count).to eq(1)
    expect(overrides.first).to have_attributes(portfolio_skill_id: current_skill.id, override_level: 5)
  end

  it 'does not pretend the assessor reviewed an AI rating they never saw (stale screen keeps the review flag)' do
    first_generation = portfolio.generations.first
    old_skill_id = current_skill.id # the assessor's old tab shows report #1, where the AI said L3
    rescore_with(model_output(level: 2, quote: quote)) # report #2 now says L2; the override is flagged

    save_override(PortfolioSkill.find(old_skill_id), level: 5, notes: 'Saved from the old tab')

    expect(the_override).to have_attributes(
      override_level: 5,              # the human decision is applied
      ai_level: 3,                    # ...recorded against what the assessor actually saw
      last_decided_on_generation_id: first_generation.id,
      needs_review: true,             # ...so it still needs a look at the current report
      review_reason: 'ai_level_changed'
    )

    save_override(current_skill, level: 5, notes: 'Confirmed against the current report')
    expect(the_override).to have_attributes(ai_level: 2, needs_review: false, review_reason: nil,
                                            last_decided_on_generation_id: portfolio.current_generation_id,
                                            first_made_on_generation_id: first_generation.id)
  end

  it 'keeps both decisions, flagged, when two overrides for one skill already exist on different reports' do
    gen1_skill = current_skill
    rescore_with(model_output(level: 3, quote: quote)) # the L4 decision moves to report #2's skill
    # Old data from before one-decision-per-skill: a second, older decision still on report #1's row.
    older = AssessorOverride.create!(portfolio_skill: gen1_skill, ai_level: 3, override_level: 2, overridden_by: 2,
                                     overridden_at: 1.hour.ago, first_made_on_generation_id: gen1_skill.generation_id,
                                     last_decided_on_generation_id: gen1_skill.generation_id)

    expect { rescore_with(model_output(level: 3, quote: quote)) }.not_to raise_error # publication must not crash

    expect(portfolio.current_generation.sequence).to eq(3)
    overrides = AssessorOverride.joins(portfolio_skill: :portfolio).where(portfolios: { id: portfolio.id })
    expect(overrides.count).to eq(2) # nothing silently discarded
    expect(the_override_with_level(4)).to have_attributes(portfolio_skill_id: current_skill.id, needs_review: true,
                                                           review_reason: 'conflicting_decisions')
    expect(older.reload).to have_attributes(portfolio_skill_id: gen1_skill.id, needs_review: true,
                                            review_reason: 'superseded_by_newer_decision')

    # React is still in the current report, so the older decision is superseded, not orphaned.
    get "/api/v1/sessions/#{session.id}/portfolio", headers: auth_headers(org)
    listed = JSON.parse(response.body).dig('portfolio', 'overrides').index_by { |o| o['id'] }
    expect(listed[older.id]).to include('orphaned' => false, 'review_reason' => 'superseded_by_newer_decision')
  end

  it 'breaks a tie between conflicting decisions with identical timestamps by the higher id' do
    gen1_skill = current_skill
    rescore_with(model_output(level: 3, quote: quote))
    gen2_skill = current_skill
    same_time = 1.hour.ago
    AssessorOverride.where(portfolio_skill_id: gen2_skill.id).update_all(overridden_at: same_time)
    lower_id_decision = AssessorOverride.find_by(portfolio_skill_id: gen2_skill.id)
    higher_id_decision = AssessorOverride.create!(portfolio_skill: gen1_skill, ai_level: 3, override_level: 2,
                                                  overridden_by: 2, overridden_at: same_time)
    expect(higher_id_decision.id).to be > lower_id_decision.id

    rescore_with(model_output(level: 3, quote: quote))

    expect(higher_id_decision.reload).to have_attributes(portfolio_skill_id: current_skill.id,
                                                         review_reason: 'conflicting_decisions')
    expect(lower_id_decision.reload.review_reason).to eq('superseded_by_newer_decision')
  end

  it 'remembers which report the human first corrected, separately from the report of the latest decision' do
    first_generation = portfolio.generations.first
    rescore_with(model_output(level: 2, quote: quote))
    save_override(current_skill, level: 3, notes: 'Re-decided on the new report')

    expect(the_override).to have_attributes(first_made_on_generation_id: first_generation.id,
                                            last_decided_on_generation_id: portfolio.current_generation_id)

    get "/api/v1/sessions/#{session.id}/portfolio", headers: auth_headers(org)
    listed = JSON.parse(response.body).dig('portfolio', 'overrides').sole
    expect(listed).to include('first_made_on_generation_id' => first_generation.id,
                              'last_decided_on_generation_id' => portfolio.current_generation_id)
  end

  it 'does not touch overrides when a new generation fails' do
    before_state = the_override.attributes.slice('portfolio_skill_id', 'override_level', 'needs_review')
    generation = Portfolios::RequestGeneration.new(portfolio: portfolio, source: 'admin_rescore', enqueue: false).call
    stub_gemini(Gemini::HttpClient::ApiError.new('API returned 404', status: 404))
    run_job(PortfolioGeneratorWorker, [session.id, generation.id])

    expect(generation.reload.status).to eq('failed')
    expect(the_override.attributes.slice('portfolio_skill_id', 'override_level', 'needs_review')).to eq(before_state)
  end

  it 'keeps the earlier generation and records where the override was originally made' do
    first_generation = portfolio.generations.first
    rescore_with(model_output(level: 2, quote: quote))

    expect(PortfolioSkill.where(generation_id: first_generation.id).count).to eq(1)
    expect(the_override).to have_attributes(first_made_on_generation_id: first_generation.id,
                                            last_decided_on_generation_id: first_generation.id)
  end
end
