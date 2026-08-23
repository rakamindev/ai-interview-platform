# frozen_string_literal: true

require 'rails_helper'

RSpec.describe SystemPromptGeneratorWorker, type: :worker do
  let(:assessment) { create(:assessment) }
  let(:worker) { described_class.new }

  describe 'sidekiq options' do
    it 'uses default queue' do
      expect(described_class.get_sidekiq_options['queue'].to_s).to eq('default')
    end

    it 'has retry set to 3' do
      expect(described_class.get_sidekiq_options['retry']).to eq(3)
    end
  end

  describe '#perform' do
    let(:mock_compiler) { instance_double(Assessments::SystemPromptCompiler) }

    before do
      allow(Assessments::SystemPromptCompiler).to receive(:new).and_return(mock_compiler)
      allow(mock_compiler).to receive(:call).and_return('Generated prompt')
    end

    it 'compiles and saves system prompt' do
      expect(Assessments::SystemPromptCompiler).to receive(:new).with(assessment)
      expect(mock_compiler).to receive(:call)
      worker.perform(assessment.id)
      expect(assessment.reload.system_prompt).to eq('Generated prompt')
    end

    it 'handles RecordNotFound gracefully' do
      expect { worker.perform(-1) }.not_to raise_error
    end
  end
end
