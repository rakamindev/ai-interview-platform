# frozen_string_literal: true

require 'rails_helper'
require 'ostruct'

RSpec.describe Portfolios::DecisionLifecycle do
  let(:portfolio) { create(:portfolio) }
  let(:actor) { OpenStruct.new(id: 42) }

  it 'uses AI by default, finalizes an override with a note, and restores AI after reopen' do
    decision = create(:portfolio_decision, portfolio:, ai_outcome: 'fail')
    lifecycle = described_class.new(portfolio:, actor:)

    expect(decision.status).to eq('ai_recommended')
    expect(decision.effective_outcome).to eq('fail')

    finalized = lifecycle.finalize(outcome: 'pass', note: 'The transcript evidence shows stronger practical delivery than the AI weighted.')

    expect(finalized.status).to eq('finalized')
    expect(finalized.effective_outcome).to eq('pass')
    expect(finalized.finalized_by_id).to eq(42)
    expect(finalized.portfolio_decision_events.pluck(:event_type)).to eq(['admin_finalized'])

    reopened = lifecycle.reopen(note: 'Reviewing the rating after an additional evidence check.')

    expect(reopened.status).to eq('ai_recommended')
    expect(reopened.effective_outcome).to eq('fail')
    expect(reopened.portfolio_decision_events.pluck(:event_type)).to eq(%w[admin_finalized admin_reopened])
  end

  it 'requires a note when the admin differs from AI' do
    create(:portfolio_decision, portfolio:, ai_outcome: 'fail')

    expect {
      described_class.new(portfolio:, actor:).finalize(outcome: 'pass', note: nil)
    }.to raise_error(described_class::InvalidDecision, /finalization note is required/)
  end

  it 'allows agreeing with the AI recommendation without a note' do
    create(:portfolio_decision, portfolio:, ai_outcome: 'pass')

    decision = described_class.new(portfolio:, actor:).finalize(outcome: 'pass', note: nil)

    expect(decision.finalized?).to be(true)
    expect(decision.finalization_note).to be_nil
  end

  it 'allows a legacy result to be finalized only with a note' do
    lifecycle = described_class.new(portfolio:, actor:)

    expect {
      lifecycle.finalize(outcome: 'pass', note: nil)
    }.to raise_error(described_class::InvalidDecision, /legacy result/)

    decision = lifecycle.finalize(outcome: 'pass', note: 'Manual decision for a portfolio generated before AI outcome recommendations.')
    expect(decision.status).to eq('finalized')
    expect(decision.ai_recommendation_available?).to be(false)
  end

  it 'does not permit finalization before the portfolio is complete' do
    portfolio.update!(generation_status: 'generating')

    expect {
      described_class.new(portfolio:, actor:).finalize(outcome: 'pass', note: 'Cannot finalize yet')
    }.to raise_error(described_class::InvalidTransition, /finish generating/)
  end
end
