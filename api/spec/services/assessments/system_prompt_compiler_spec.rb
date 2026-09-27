# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Assessments::SystemPromptCompiler do
  let(:assessment) { create(:assessment) }
  let!(:skill) { create(:assessment_skill, assessment: assessment) }

  describe '#call' do
    subject(:prompt) { described_class.new(assessment).call }

    it 'includes an explicit constraint forbidding internal reasoning, pacing info, and current goal headers' do
      expect(prompt).to include('Pacing info:')
      expect(prompt).to include('Current goal:')
      expect(prompt).to match(/never output any (?:internal )?reasoning/i)
    end
  end
end
