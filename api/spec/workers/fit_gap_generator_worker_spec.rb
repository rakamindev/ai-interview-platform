require 'rails_helper'

RSpec.describe FitGapGeneratorWorker do
  let(:review) { create_review }
  let(:portfolio) { review.first }
  let(:vacancy) { review.last }
  let(:report) { FitGap::RequestGeneration.call(portfolio: portfolio, vacancy: vacancy) }

  before { add_requirement(vacancy); add_rating(portfolio) }

  it 'is idempotent when Sidekiq delivers the same job twice' do
    args = [report.id, report.generation_token, 101]
    2.times { described_class.new.perform(*args) }
    expect(report.reload.review_status).to eq('complete')
    expect(report.skill_comparisons.length).to eq(1)
    expect(FitGapReport.count).to eq(1)
  end

  it 'ignores a superseded generation token' do
    described_class.new.perform(report.id, 'obsolete-token', 101)
    expect(report.reload.generation_status).to eq('pending')
  end

  it 'does not process work for another tenant' do
    described_class.new.perform(report.id, report.generation_token, 202)
    expect(report.reload.generation_status).to eq('pending')
    expect(report.skill_comparisons).to eq([])
  end

  it 'rolls back partial writes and records failure without leaking exception contents' do
    previous = FitGap::Engine.new(portfolio: portfolio, vacancy: vacancy).call
    report = FitGap::RequestGeneration.call(portfolio: portfolio, vacancy: vacancy, force: true)
    original = previous.skill_comparisons
    allow_any_instance_of(FitGap::Engine).to receive(:call) do
      report.update!(skill_comparisons: [{ bad_partial_write: true }])
      raise Timeout::Error, 'private transcript must not be stored'
    end
    described_class.new.perform(report.id, report.generation_token, 101)
    expect(report.reload).to have_attributes(generation_status: 'failed', error_code: 'generation_failed')
    expect(report.skill_comparisons).to eq(original)
    expect(report.attributes.values.join).not_to include('private transcript')
  end
end
