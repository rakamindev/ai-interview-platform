# frozen_string_literal: true

require 'rails_helper'

# N2: the interviewer's instructions are compiled from the assessor's config.
# Whatever the assessor writes must reach the model, in their order and language.
RSpec.describe Assessments::SystemPromptCompiler do
  let(:assessment) { create(:assessment, language: 'en') }

  def compile = described_class.new(assessment.reload).call

  def add_skill(label, order, **attrs)
    create(:assessment_skill, assessment:, skill_label: label, display_order: order, **attrs)
  end

  it 'lists every skill with its five level anchors, in display order' do
    add_skill('System Design', 1, l3_anchor: 'Designs for 10x load with explicit trade-offs.')
    add_skill('React', 0)

    prompt = compile

    expect(prompt.index('SKILL: React')).to be < prompt.index('SKILL: System Design')
    expect(prompt).to include('L3 — Designs for 10x load with explicit trade-offs.')
    %w[L1 L2 L3 L4 L5].each { |level| expect(prompt.scan(/^#{level} — /).size).to eq(2) }
  end

  it 'includes scope lines only when the assessor wrote them' do
    add_skill('React', 0, scope_include: 'Hooks, state, rendering performance', scope_exclude: 'Class components')
    add_skill('Communication', 1, scope_include: nil, scope_exclude: '')

    prompt = compile

    expect(prompt).to include('SCOPE: Hooks, state, rendering performance', 'WHAT DOES NOT COUNT: Class components')
    expect(prompt.scan('SCOPE:').size).to eq(1)
    expect(prompt.scan('WHAT DOES NOT COUNT:').size).to eq(1)
  end

  it 'tells the interviewer to speak the assessment language' do
    assessment.update!(language: 'id')

    expect(compile).to include('Conduct this entire interview in Bahasa Indonesia.')
  end

  it 'falls back to English when no language is set' do
    assessment.update_column(:language, nil)

    expect(compile).to include('Conduct this entire interview in English.')
  end

  it 'keeps the PRD interview rules and never hands the model a question list' do
    add_skill('React', 0)

    prompt = compile

    expect(prompt).to include('You are NOT given a question list.', 'PROBE WHAT THEY SAID', 'COVERAGE GUIDANCE')
  end

  it 'passes long, multi-line anchors through intact' do
    long_anchor = "Line one of the anchor.\nLine two with \"quotes\" and — dashes.\n#{'x' * 5_000}"
    add_skill('React', 0, l5_anchor: long_anchor)

    expect(compile).to include("L5 — #{long_anchor}")
  end
end
