# frozen_string_literal: true

require 'rails_helper'

RSpec.describe FitGapGeneratorWorker do
  subject(:worker) { described_class.new }

  let(:org_a)     { create(:organization) }
  let(:org_b)     { create(:organization) }
  let(:portfolio) { create(:portfolio, session: create(:session, organization: org_a)) }

  it 'refuses to generate when vacancy belongs to a different tenant' do
    foreign_vacancy = create(:vacancy, organization: org_b)

    expect(FitGap::Engine).not_to receive(:new)
    worker.perform(portfolio.id, foreign_vacancy.id)

    expect(FitGapReport.where(portfolio_id: portfolio.id).count).to eq(0)
  end

  it 'generates when vacancy and portfolio share the tenant' do
    vacancy = create(:vacancy, organization: org_a)
    engine  = instance_double(FitGap::Engine, call: true)

    expect(FitGap::Engine).to receive(:new)
      .with(portfolio: portfolio, vacancy: vacancy)
      .and_return(engine)

    worker.perform(portfolio.id, vacancy.id)
  end

  it 'does not raise when the portfolio no longer exists' do
    expect { worker.perform(-1, -1) }.not_to raise_error
  end
end