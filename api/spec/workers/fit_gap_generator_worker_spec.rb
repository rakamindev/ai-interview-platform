# frozen_string_literal: true

require 'rails_helper'

RSpec.describe FitGapGeneratorWorker do
  let(:report) do
    FitGapReport.create!(portfolio: create(:portfolio), vacancy: create(:vacancy),
                         status: 'generating', skill_comparisons: [])
  end

  # AC14: a job that exhausts its retries must leave a visible failed state, not an endless "generating".
  it 'marks the report failed with a generic message once retries are exhausted' do
    msg = { 'args' => [report.portfolio_id, report.vacancy_id], 'error_message' => 'Candidate Budi said ...' }

    described_class.sidekiq_retries_exhausted_block.call(msg, StandardError.new('boom'))

    expect(report.reload.status).to eq('failed')
    expect(report.error_message).to be_present
    # UU PDP: never copy raw job/model output (may contain candidate data) into the record.
    expect(report.error_message).not_to include('Budi')
  end
end
