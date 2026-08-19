require 'rails_helper'

RSpec.describe Assessments::SystemPromptCompiler do
  describe 'signal authentication token' do
    it 'defaults to the historical token when INTERVIEW_SIGNAL_TOKEN is unset (backward compatible)' do
      assessment = create(:assessment, tenant_id: 1)

      prompt = described_class.new(assessment).call

      expect(prompt).to include('SYS-TC-7x9k')
    end

    it 'uses the token from INTERVIEW_SIGNAL_TOKEN when set' do
      allow(ENV).to receive(:fetch).and_call_original
      allow(ENV).to receive(:fetch).with('INTERVIEW_SIGNAL_TOKEN', anything).and_return('CUSTOM-TOKEN-123')
      assessment = create(:assessment, tenant_id: 1)

      prompt = described_class.new(assessment).call

      expect(prompt).to include('CUSTOM-TOKEN-123')
      expect(prompt).not_to include('SYS-TC-7x9k')
    end
  end
end
