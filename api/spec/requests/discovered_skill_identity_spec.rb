# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Discovered skill identity across generations', type: :request do
  let(:org)        { create_org }
  let(:assessment) { create_assessment(org: org) }
  let(:session)    { create_interviewed_session(org: org, assessment: assessment) }
  let(:quote)     { 'I moved the feed into a store so components subscribe to just the slice they need.' }

  def portfolio = session.reload.portfolio

  def publish_discovered(*labels)
    session.update!(status: 'ended')
    pf = session.reload.portfolio || session.create_portfolio!(generation_status: 'pending')
    generation = Portfolios::RequestGeneration.new(portfolio: pf, source: 'admin_rescore', enqueue: false).call
    output = model_output(level: 3, quote: quote)
    output['discovered_skills'] = labels.map do |label|
      { 'skill_label' => label, 'level' => 3, 'evidence' => [quote], 'competency_summary' => 'Synthetic discovery' }
    end
    Portfolios::Generator.new(generation: generation, gemini_client: TestData::FakeGemini.new(output)).call
    generation.reload
  end

  def discovered(label)
    portfolio.portfolio_skills.find_by!(skill_label: label, is_discovered: true)
  end

  def save_decision(skill, level:, notes:)
    post "/api/v1/portfolio_skills/#{skill.id}/override",
         params: { override: { override_level: level, assessor_notes: notes } }, headers: auth_headers(org)
    expect(response).to have_http_status(:created).or have_http_status(:ok)
    AssessorOverride.find_by!(portfolio_skill_id: skill.id)
  end

  it 'preserves a C++ correction as an earlier decision when the next report discovers C#' do
    publish_discovered('C++')
    old = discovered('C++')
    decision = save_decision(old, level: 5, notes: 'strong C++')

    publish_discovered('C#')
    current = discovered('C#')
    expect(AssessorOverride.find_by(portfolio_skill_id: current.id)).to be_nil
    expect(decision.reload).to have_attributes(portfolio_skill_id: old.id, override_level: 5,
                                               assessor_notes: 'strong C++', needs_review: true,
                                               review_reason: 'skill_missing_in_current')
    get "/api/v1/sessions/#{session.id}/portfolio", headers: auth_headers(org)
    expect(response).to have_http_status(:ok)
    listed = JSON.parse(response.body).dig('portfolio', 'overrides').find { |o| o['id'] == decision.id }
    expect(listed).to include('orphaned' => true, 'skill_label' => 'C++', 'override_level' => 5)
  end

  it 'does not redirect a stale C++ save or find the current C# decision through the colliding key' do
    publish_discovered('C++')
    old = discovered('C++')
    publish_discovered('C#')
    current = discovered('C#')
    current_decision = save_decision(current, level: 2, notes: 'C# decision')

    post "/api/v1/portfolio_skills/#{old.id}/override",
         params: { override: { override_level: 5, assessor_notes: 'strong C++' } }, headers: auth_headers(org)
    expect(response).to have_http_status(:created)
    expect(current_decision.reload).to have_attributes(portfolio_skill_id: current.id, override_level: 2,
                                                       assessor_notes: 'C# decision', needs_review: false)
    old_decision = AssessorOverride.find_by!(portfolio_skill_id: old.id)
    expect(old_decision).to have_attributes(override_level: 5, assessor_notes: 'strong C++', needs_review: true,
                                           review_reason: 'skill_missing_in_current')
    get "/api/v1/sessions/#{session.id}/portfolio", headers: auth_headers(org)
    listed = JSON.parse(response.body).dig('portfolio', 'overrides').index_by { |o| o['id'] }
    expect(listed[old_decision.id]).to include('orphaned' => true, 'skill_label' => 'C++')
    expect(listed[current_decision.id]).to include('orphaned' => false, 'skill_label' => 'C#')
  end

  it 'records the second colliding discovered label instead of silently dropping it' do
    generation = publish_discovered('C++', 'C#')
    expect(portfolio.portfolio_skills.where(is_discovered: true).pluck(:skill_label)).to eq(['C++'])
    expect(generation.validation.fetch('rejected_skills')).to include(
      'skill_label' => 'C#', 'reason' => 'duplicate_discovered_identity'
    )
  end

  it 'carries a correction to the same discovered C++ identity without a review flag' do
    publish_discovered('C++')
    old = discovered('C++')
    decision = save_decision(old, level: 5, notes: 'strong C++')
    publish_discovered('C++')
    current = discovered('C++')

    expect(current.id).not_to eq(old.id)
    expect(decision.reload).to have_attributes(portfolio_skill_id: current.id, override_level: 5,
                                               assessor_notes: 'strong C++', needs_review: false, review_reason: nil)
  end
end
