# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Assessments::SystemPromptCompiler, type: :model do
  let(:assessment) { create(:assessment, :with_skills) }
  let(:compiler) { described_class.new(assessment) }

  describe '#call' do
    it 'returns a complete system prompt string' do
      prompt = compiler.call
      expect(prompt).to be_a(String)
      expect(prompt.length).to be > 500
    end

    it 'includes language section' do
      prompt = compiler.call
      expect(prompt).to include('LANGUAGE:')
      expect(prompt).to include('English')
    end

    it 'includes all skill blocks' do
      prompt = compiler.call
      assessment.assessment_skills.each do |skill|
        expect(prompt).to include(skill.skill_label)
      end
    end

    it 'includes all 9 rules' do
      prompt = compiler.call
      (1..9).each do |n|
        expect(prompt).to include("#{n}.")
      end
    end

    it 'includes coverage guidance section' do
      prompt = compiler.call
      expect(prompt).to include('COVERAGE GUIDANCE')
      expect(prompt).to include('SYS-TC-7x9k')
    end

    it 'includes pacing section' do
      prompt = compiler.call
      expect(prompt).to include('PACING DISCIPLINE')
      expect(prompt).to include('pacing=ahead')
      expect(prompt).to include('pacing=critical')
    end

    it 'includes tone section' do
      prompt = compiler.call
      expect(prompt).to include('TONE AND STYLE')
    end

    it 'includes opening section' do
      prompt = compiler.call
      expect(prompt).to include('OPENING')
    end

    it 'includes skill definitions with anchors' do
      prompt = compiler.call
      assessment.assessment_skills.each do |skill|
        expect(prompt).to include(skill.l1_anchor)
        expect(prompt).to include(skill.l5_anchor)
      end
    end
  end

  describe 'language support' do
    it 'uses Indonesian for id language' do
      assessment.update(language: 'id')
      prompt = compiler.call
      expect(prompt).to include('Bahasa Indonesia')
    end

    it 'defaults to English for unknown language' do
      assessment.update(language: 'fr')
      prompt = compiler.call
      expect(prompt).to include('English')
    end
  end

  describe 'skill_block' do
    it 'formats skill with scope and anchors' do
      skill = assessment.assessment_skills.first
      block = compiler.send(:skill_block, skill)

      expect(block).to include(skill.skill_label)
      expect(block).to include('SCOPE:')
      expect(block).to include('L1')
      expect(block).to include('L5')
    end
  end
end