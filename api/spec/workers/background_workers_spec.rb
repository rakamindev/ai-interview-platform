# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Background workers' do
  describe SystemPromptGeneratorWorker do
    it 'stores the compiled prompt on the assessment' do
      assessment = create(:assessment, :with_skills)

      described_class.new.perform(assessment.id)

      expect(assessment.reload.system_prompt).to include('SKILL: React')
    end

    it 'skips quietly when the assessment was deleted' do
      expect { described_class.new.perform(-1) }.not_to raise_error
    end

    it 're-raises other failures so Sidekiq retries' do
      assessment = create(:assessment)
      allow(Assessments::SystemPromptCompiler).to receive(:new).and_raise(StandardError, 'boom')

      expect { described_class.new.perform(assessment.id) }.to raise_error(StandardError, 'boom')
    end
  end

  describe FitGapGeneratorWorker do
    let(:portfolio) { create(:portfolio) }
    let(:vacancy)   { create(:vacancy) }

    it 'runs the engine for the portfolio and vacancy' do
      engine = instance_double(FitGap::Engine, call: nil)
      allow(FitGap::Engine).to receive(:new).with(portfolio:, vacancy:).and_return(engine)

      described_class.new.perform(portfolio.id, vacancy.id)

      expect(engine).to have_received(:call)
    end

    it 'skips quietly when the portfolio or the vacancy no longer exists' do
      expect { described_class.new.perform(-1, vacancy.id) }.not_to raise_error
      expect { described_class.new.perform(portfolio.id, -1) }.not_to raise_error
    end

    it 're-raises engine failures so Sidekiq retries' do
      allow(FitGap::Engine).to receive(:new).and_raise(ActiveRecord::StatementInvalid, 'db down')

      expect { described_class.new.perform(portfolio.id, vacancy.id) }.to raise_error(ActiveRecord::StatementInvalid)
    end
  end
end
