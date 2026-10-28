# frozen_string_literal: true

require 'rails_helper'

RSpec.describe PortfolioGeneratorWorker do
  describe '#perform' do
    it 'calls the portfolio generator for an existing session' do
      session = instance_double(Session)
      generator = instance_double(Portfolios::Generator)

      allow(Session).to receive(:find).with(6).and_return(session)
      expect(Portfolios::Generator)
        .to receive(:new).with(session: session).and_return(generator)
      expect(generator).to receive(:call)

      described_class.new.perform(6)
    end

    it 'skips a session that cannot be found' do
      allow(Session).to receive(:find)
        .with(999)
        .and_raise(ActiveRecord::RecordNotFound)

      expect(Rails.logger).to receive(:warn)
        .with('[N10] Session 999 not found — skipping')

      expect { described_class.new.perform(999) }.not_to raise_error
    end
  end
end
