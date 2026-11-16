# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Assessments::SystemPromptCompiler do
  it 'compiles the assessment language and skill anchors into the system prompt' do
    assessment = create(:assessment, language: 'id')
    create(
      :assessment_skill,
      assessment: assessment,
      skill_label: 'Ruby',
      scope_include: 'Backend development',
      scope_exclude: 'Syntax trivia',
      l1_anchor: 'Writes basic scripts',
      l2_anchor: 'Uses common abstractions',
      l3_anchor: 'Builds maintainable services',
      l4_anchor: 'Designs robust systems',
      l5_anchor: 'Sets technical direction'
    )

    prompt = described_class.new(assessment).call

    expect(prompt).to include('LANGUAGE: Conduct this entire interview in Bahasa Indonesia')
    expect(prompt).to include('SKILL: Ruby')
    expect(prompt).to include('SCOPE: Backend development')
    expect(prompt).to include('WHAT DOES NOT COUNT: Syntax trivia')
    expect(prompt).to include('L5 — Sets technical direction')
    expect(prompt).to include('SYS-TC-7x9k')
  end

  it 'uses English when the assessment language is absent' do
    assessment = build(:assessment, language: nil)
    prompt = described_class.new(assessment).call
    expect(prompt).to include('LANGUAGE: Conduct this entire interview in English')
  end
end
