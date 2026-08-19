# frozen_string_literal: true

require 'rails_helper'

RSpec.describe SystemPromptGeneratorWorker do
  describe '#perform' do
    let(:assessment) { create(:assessment, :with_skills) }

    it 'generates and saves the system prompt' do
      described_class.new.perform(assessment.id)
      assessment.reload
      expect(assessment.system_prompt).to be_present
      expect(assessment.system_prompt).to include('INTERVIEW RULES')
    end

    it 'handles missing assessment gracefully' do
      expect(Rails.logger).to receive(:warn).with(/not found/)
      described_class.new.perform(-1)
    end
  end
end
