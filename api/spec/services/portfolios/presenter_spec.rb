# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Portfolios::Presenter do
  let(:assessment) { create(:assessment, tenant_id: 1) }
  let(:session)    { create(:session, assessment: assessment, tenant_id: 1) }
  let!(:portfolio) { create(:portfolio, session: session, generation_status: 'complete') }

  def plan(label, expected: 3)
    create(:assessment_skill, assessment: assessment, skill_label: label, expected_level: expected)
  end

  def coverage(label, state:, probes:, discovered: false)
    create(:coverage_map, session: session, skill_label: label,
                          state: state, probe_count: probes, is_discovered: discovered)
  end

  def ai_skill(label, level:, confidence: 'high', evidence: ['a quote'], discovered: false)
    create(:portfolio_skill, portfolio: portfolio, skill_label: label, ai_level: level,
                             ai_confidence: confidence, evidence: evidence, is_discovered: discovered)
  end

  def view_for(label)
    described_class.new(session: session).call[:skills].find { |v| v.skill_label == label }
  end

  it 'marks a well-covered skill with evidence as assessed' do
    plan('React'); coverage('React', state: 'covered', probes: 3); ai_skill('React', level: 4)

    v = view_for('React')
    expect(v.state).to eq('assessed')
    expect(v.effective_level).to eq(4)
  end

  it 'never fabricates a level for an unassessed skill even if the AI returned one (AC-1/AC-3)' do
    plan('Kubernetes'); coverage('Kubernetes', state: 'not_yet', probes: 0)
    ai_skill('Kubernetes', level: 5, confidence: 'high') # AI hallucinated a level

    v = view_for('Kubernetes')
    expect(v.state).to eq('not_assessed')
    expect(v.effective_level).to be_nil
    expect(v.expected_level).to eq(3)
  end

  it 'treats a planned skill with no AI output as not_assessed (AC-2)' do
    plan('GraphQL'); coverage('GraphQL', state: 'not_yet', probes: 0)

    expect(view_for('GraphQL').state).to eq('not_assessed')
  end

  it 'downgrades a covered skill to partially_assessed when confidence is low (AC-6)' do
    plan('SQL'); coverage('SQL', state: 'covered', probes: 3); ai_skill('SQL', level: 3, confidence: 'low')

    expect(view_for('SQL').state).to eq('partially_assessed')
  end

  it 'marks a lightly-probed skill as partially_assessed' do
    plan('Docker'); coverage('Docker', state: 'partial', probes: 1); ai_skill('Docker', level: 2)

    expect(view_for('Docker').state).to eq('partially_assessed')
  end

  # AC-5 note: ai_level is guaranteed to be 1..5 by BOTH a model validation and a DB
  # check constraint (chk_portfolio_skills_ai_level), so out-of-range values cannot be
  # persisted. The presenter keeps a defensive clamp, but there is no reachable state to
  # assert here — the criterion is already defended at the data layer.

  it 'filters non-string / blank evidence entries (AC-8)' do
    plan('Go'); coverage('Go', state: 'covered', probes: 3)
    ai_skill('Go', level: 3, evidence: ['good quote', 123, nil, '', 'another'])

    expect(view_for('Go').evidence).to eq(['good quote', 'another'])
  end

  it 'lets an assessor override win and exposes the audit trail (AC-15)' do
    plan('Ruby'); coverage('Ruby', state: 'covered', probes: 3)
    skill = ai_skill('Ruby', level: 3)
    create(:assessor_override, portfolio_skill: skill, ai_level: 3, override_level: 5,
                              assessor_notes: 'Strong system design in the transcript.')

    v = view_for('Ruby')
    expect(v.effective_level).to eq(5)
    expect(v.override[:reason]).to eq('Strong system design in the transcript.')
  end

  it 'surfaces discovered skills as their own state' do
    coverage('Prompt Engineering', state: 'covered', probes: 2, discovered: true)
    ai_skill('Prompt Engineering', level: 3, discovered: true)

    expect(view_for('Prompt Engineering').state).to eq('discovered')
  end

  it 'returns a summary with counts by state' do
    plan('A'); coverage('A', state: 'covered', probes: 3); ai_skill('A', level: 4)
    plan('B'); coverage('B', state: 'not_yet', probes: 0)

    summary = described_class.new(session: session).call[:summary]
    expect(summary[:assessed]).to eq(1)
    expect(summary[:not_assessed]).to eq(1)
    expect(summary[:total]).to eq(2)
  end
end
