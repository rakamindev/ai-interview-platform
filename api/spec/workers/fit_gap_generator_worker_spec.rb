# frozen_string_literal: true

require 'rails_helper'

RSpec.describe FitGapGeneratorWorker, type: :worker do
  let(:portfolio) { create(:portfolio, :complete) }
  let(:vacancy) { create(:vacancy) }
  let(:worker) { described_class.new }

  describe 'sidekiq options' do
    it 'uses default queue' do
      expect(described_class.get_sidekiq_options['queue'].to_s).to eq('default')
    end

    it 'has retry set to 2' do
      expect(described_class.get_sidekiq_options['retry']).to eq(2)
    end
  end

  describe '#perform' do
    let(:mock_engine) { instance_double(FitGap::Engine) }

    before do
      allow(FitGap::Engine).to receive(:new).and_return(mock_engine)
      allow(mock_engine).to receive(:call).and_return(double('report'))
    end

    it 'calls the fit gap engine' do
      expect(FitGap::Engine).to receive(:new).with(portfolio: portfolio, vacancy: vacancy)
      expect(mock_engine).to receive(:call)
      worker.perform(portfolio.id, vacancy.id)
    end

    it 'handles RecordNotFound gracefully' do
      expect { worker.perform(-1, -1) }.not_to raise_error
    end
  end
end
