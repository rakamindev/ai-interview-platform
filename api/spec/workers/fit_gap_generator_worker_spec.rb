# frozen_string_literal: true

require 'rails_helper'

RSpec.describe FitGapGeneratorWorker do
  it 'marks the report failed when retries are exhausted' do
    org = create(:organization)
    session = create(:session, tenant_id: org.id)
    portfolio = create(:portfolio, session: session)
    vacancy = create(:vacancy, tenant_id: org.id)
    report = FitGapReport.create!(
      portfolio: portfolio, vacancy: vacancy, skill_comparisons: [], generation_status: 'generating',
    )

    described_class.mark_failed(portfolio.id, vacancy.id, 'boom (retries exhausted)')

    report.reload
    expect(report.generation_status).to eq('failed')
    expect(report.generation_error).to include('boom')
  end
end
