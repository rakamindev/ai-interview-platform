# frozen_string_literal: true

require 'rails_helper'

RSpec.describe PortfolioGeneratorWorker, type: :worker do
  let(:session) { create(:session, :ended) }
  let(:worker) { described_class.new }

  describe 'sidekiq options' do
    it 'uses portfolio queue' do
      expect(described_class.get_sidekiq_options['queue'].to_s).to eq('portfolio')
    end

    it 'has retry set to 3' do
      expect(described_class.get_sidekiq_options['retry']).to eq(3)
    end
  end

  describe '#perform' do
    let(:mock_generator) { instance_double(Portfolios::Generator) }

    before do
      allow(Portfolios::Generator).to receive(:new).and_return(mock_generator)
      allow(mock_generator).to receive(:call).and_return(double('portfolio'))
    end

    it 'calls the portfolio generator' do
      expect(Portfolios::Generator).to receive(:new).with(session: session)
      expect(mock_generator).to receive(:call)
      worker.perform(session.id)
    end

    it 'handles RecordNotFound gracefully' do
      expect { worker.perform(-1) }.not_to raise_error
    end
  end
end
