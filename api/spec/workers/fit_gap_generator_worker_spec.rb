# frozen_string_literal: true

require 'rails_helper'

RSpec.describe FitGapGeneratorWorker do
  let(:org_a)     { create(:organization) }
  let(:org_b)     { create(:organization) }
  let(:portfolio) { create(:portfolio, session: create(:session, assessment: create(:assessment, organization: org_a))) }

  let(:engine) { instance_double(FitGap::Engine, call: nil) }

  before { allow(FitGap::Engine).to receive(:new).and_return(engine) }

  # AC-61: jobs run outside a request, so the tenant check must happen here too.
  it 'refuses to build a report from a portfolio and a vacancy of different organisations' do
    foreign_vacancy = create(:vacancy, organization: org_b)

    described_class.new.perform(portfolio.id, foreign_vacancy.id)

    expect(FitGap::Engine).not_to have_received(:new)
    expect(FitGapReport.count).to eq(0)
  end

  it 'logs a tenant mismatch with record ids only, never candidate data' do
    portfolio.session.update!(candidate_name: 'Kandidat Contoh Rahasia')
    foreign_vacancy = create(:vacancy, organization: org_b, role_title: 'Contoh Posisi Rahasia')
    allow(Rails.logger).to receive(:warn)

    described_class.new.perform(portfolio.id, foreign_vacancy.id)

    expect(Rails.logger).to have_received(:warn)
      .with("[N13] Skipped fit/gap: tenant mismatch portfolio=#{portfolio.id} vacancy=#{foreign_vacancy.id}")
  end

  it 'builds the report when portfolio and vacancy belong to the same organisation' do
    vacancy = create(:vacancy, organization: org_a)

    described_class.new.perform(portfolio.id, vacancy.id)

    expect(FitGap::Engine).to have_received(:new).with(portfolio: portfolio, vacancy: vacancy)
    expect(engine).to have_received(:call)
  end
end
