# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Assessments::SystemPromptCompiler do
  let(:assessment) { create(:assessment, :with_skills, name: 'Senior React Developer', language: 'en') }
  let(:compiler) { described_class.new(assessment) }

  describe '#call' do
    subject { compiler.call }

    it 'returns a non-empty string' do
      expect(subject).to be_a(String)
      expect(subject.length).to be > 100
    end

    it 'includes the assessment language' do
      expect(subject).to include('English')
    end

    it 'includes skill labels from the assessment' do
      assessment.assessment_skills.each do |skill|
        expect(subject).to include(skill.skill_label)
      end
    end

    it 'includes L1-L5 anchors' do
      skill = assessment.assessment_skills.first
      expect(subject).to include(skill.l1_anchor)
      expect(subject).to include(skill.l5_anchor)
    end

    it 'includes interview rules section' do
      expect(subject).to include('INTERVIEW RULES')
    end

    it 'includes coverage guidance section' do
      expect(subject).to include('COVERAGE GUIDANCE')
    end

    it 'includes pacing section' do
      expect(subject).to include('PACING DISCIPLINE')
    end

    it 'includes tone section' do
      expect(subject).to include('TONE AND STYLE')
    end

    it 'includes opening section' do
      expect(subject).to include('OPENING')
    end
  end

  describe 'Indonesian language' do
    let(:assessment) { create(:assessment, :indonesian, :with_skills) }

    it 'uses Bahasa Indonesia in the prompt' do
      expect(compiler.call).to include('Bahasa Indonesia')
    end
  end
end
