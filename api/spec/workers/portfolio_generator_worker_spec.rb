# frozen_string_literal: true

require_relative '../spec_helper'
require 'sidekiq'
require_relative '../../app/workers/portfolio_generator_worker'

RSpec.describe PortfolioGeneratorWorker do
  let(:logger) { instance_double('Logger', info: nil, warn: nil, error: nil) }

  before do
    stub_const('Rails', double('Rails', logger: logger))
    stub_const('Session', Class.new)
    stub_const('Portfolios::Generator', Class.new)
    stub_const('ActiveRecord::RecordNotFound', Class.new(StandardError))
  end

  it 'uses bounded retries on the portfolio queue' do
    expect(described_class.get_sidekiq_options['queue']).to eq(:portfolio)
    expect(described_class.get_sidekiq_options['retry']).to eq(3)
  end

  it 'does not regenerate an already-complete portfolio from a duplicate job' do
    session = double('Session', id: 12, portfolio: double('Portfolio', complete?: true))
    allow(Session).to receive(:find).with(12).and_return(session)

    expect(Portfolios::Generator).not_to receive(:new)

    described_class.new.perform(12)
  end

  it 'runs generation for a pending portfolio' do
    session = double('Session', id: 12, portfolio: double('Portfolio', complete?: false))
    generator = instance_double(Portfolios::Generator, call: true)
    allow(Session).to receive(:find).with(12).and_return(session)
    allow(Portfolios::Generator).to receive(:new).with(session: session).and_return(generator)

    expect(generator).to receive(:call)

    described_class.new.perform(12)
  end

  it 'skips a deleted session instead of retrying forever' do
    allow(Session).to receive(:find).with(404).and_raise(ActiveRecord::RecordNotFound)

    expect { described_class.new.perform(404) }.not_to raise_error
    expect(logger).to have_received(:warn).with(/Session 404 not found/)
  end
end
