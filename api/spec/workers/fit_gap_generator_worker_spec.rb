# frozen_string_literal: true

require 'rails_helper'

RSpec.describe FitGapGeneratorWorker do
  let(:org)       { build_org }
  let(:portfolio) { build_portfolio(build_session(org)) }
  let(:vacancy)   { build_vacancy(org, skills: { 'React' => 3 }) }

  before { add_portfolio_skill(portfolio, label: 'React', level: 3) }

  it 'only generates the narrative' do
    engine = instance_double(FitGap::Engine, generate_narrative!: true)
    allow(FitGap::Engine).to receive(:new).and_return(engine)

    described_class.new.perform(portfolio.id, vacancy.id)

    expect(engine).to have_received(:generate_narrative!)
  end

  it 'skips quietly when the portfolio or vacancy was deleted' do
    expect { described_class.new.perform(0, vacancy.id) }.not_to raise_error
    expect { described_class.new.perform(portfolio.id, 0) }.not_to raise_error
  end

  it 'marks a still-pending narrative failed once Sidekiq gives up, so the UI stops waiting' do
    report = FitGap::Engine.new(portfolio: portfolio, vacancy: vacancy).refresh_comparisons!
    expect(report.narrative_status).to eq('pending')

    described_class.sidekiq_retries_exhausted_block.call({ 'args' => [portfolio.id, vacancy.id] }, StandardError.new)

    expect(report.reload).to have_attributes(narrative_status: 'failed', generation_error: 'RetriesExhausted')
  end

  it 'does not touch a report that finished in the meantime' do
    report = FitGap::Engine.new(portfolio: portfolio, vacancy: vacancy).refresh_comparisons!
    report.update!(narrative_status: 'ready')

    described_class.sidekiq_retries_exhausted_block.call({ 'args' => [portfolio.id, vacancy.id] }, StandardError.new)

    expect(report.reload.narrative_status).to eq('ready')
  end
end
