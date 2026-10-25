require 'rails_helper'

RSpec.describe FitGap::RequestGeneration do
  let(:review) { create_review }
  let(:portfolio) { review.first }
  let(:vacancy) { review.last }

  def request_report(force: false)
    described_class.call(portfolio: portfolio, vacancy: vacancy, force: force)
  end

  it 'persists a safe failure when Redis is unavailable' do
    allow(FitGapGeneratorWorker).to receive(:perform_async).and_raise(Redis::CannotConnectError, 'sensitive provider payload')
    report = request_report
    expect(report).to have_attributes(generation_status: 'failed', error_code: 'queue_unavailable')
    expect(report.attributes.values.join).not_to include('sensitive provider payload')
  end

  it 'allows explicit retry after a lost or expired queue job' do
    report = request_report
    old_token = report.generation_token
    report.update!(requested_at: 3.minutes.ago)
    expect(report.review_status).to eq('failed')
    retried = request_report(force: true)
    expect(retried.generation_token).not_to eq(old_token)
    expect(FitGapGeneratorWorker.jobs.length).to eq(2)
  end

  it 'retains the last successful snapshot while refreshing' do
    add_requirement(vacancy)
    add_rating(portfolio)
    previous = FitGap::Engine.new(portfolio: portfolio, vacancy: vacancy).call
    report = request_report(force: true)
    expect(report.generation_status).to eq('pending')
    expect(report.skill_comparisons).to eq(previous.skill_comparisons)
    expect(report.generated_at).to eq(previous.generated_at)
  end
end
