# frozen_string_literal: true

require 'rails_helper'

RSpec.describe PortfolioGeneratorWorker do
  describe '#perform' do
    let(:session) { create(:session, :ended) }

    before do
      allow_any_instance_of(Portfolios::Generator).to receive(:call).and_return(
        create(:portfolio, session: session, generation_status: 'complete')
      )
    end

    it 'calls Portfolios::Generator with the session' do
      expect_any_instance_of(Portfolios::Generator).to receive(:call)
      described_class.new.perform(session.id)
    end

    it 'handles missing session gracefully' do
      expect(Rails.logger).to receive(:warn).with(/not found/)
      described_class.new.perform(-1)
    end
  end
end
