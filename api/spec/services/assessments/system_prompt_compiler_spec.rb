# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Assessments::SystemPromptCompiler do
  let(:hash_skill) do
    {
      'skill_id' => 'ruby', 'skill_label' => 'Ruby', 'is_custom' => false,
      'scope_include' => 'Core language usage', 'scope_exclude' => 'Rails specifics',
      'l1_anchor' => 'L1', 'l2_anchor' => 'L2', 'l3_anchor' => 'L3', 'l4_anchor' => 'L4', 'l5_anchor' => 'L5',
      'expected_level' => 3, 'display_order' => 0
    }
  end

  it 'compiles a prompt from a jsonb skills_snapshot (hash) array' do
    prompt = described_class.new(language: 'en', skills: [hash_skill]).call

    expect(prompt).to include('SKILL: Ruby')
    expect(prompt).to include('Core language usage')
    expect(prompt).to include('LANGUAGE: Conduct this entire interview in English')
  end

  it 'compiles a prompt from live AssessmentSkill records' do
    assessment = create(:assessment, language: 'id')
    create(:assessment_skill, assessment: assessment, skill_label: 'Communication')
    assessment.reload

    prompt = described_class.new(
      language: assessment.language,
      skills:   assessment.assessment_skills.order(:display_order)
    ).call

    expect(prompt).to include('SKILL: Communication')
    expect(prompt).to include('Bahasa Indonesia')
  end
end
