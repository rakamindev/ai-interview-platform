# frozen_string_literal: true

require 'rails_helper'

RSpec.describe FitGapGeneratorWorker do
  let(:scenario) { build_fit_gap_scenario }
  let(:portfolio) { scenario[:portfolio] }
  let(:vacancy) { scenario[:vacancy] }
  let!(:report) { create(:fit_gap_report, portfolio:, vacancy:, status: 'pending', skill_comparisons: []) }
  let(:client) { fake_model(ai_narrative) }

  before { allow(Gemini::HttpClient).to receive(:new).and_return(client) }

  def perform = described_class.new.perform(portfolio.id, vacancy.id)

  it 'generates the report' do
    perform

    expect(report.reload).to have_attributes(status: 'complete', narrative_source: 'ai')
    expect(report.skill_comparisons.size).to eq(4)
  end

  it 'is a no-op when the report is already up to date (duplicate job, AC14)' do
    perform
    perform

    expect(client).to have_received(:generate_content).once
  end

  it 'reschedules itself instead of computing twice while another job holds the lease' do
    report.update!(status: 'generating', generation_started_at: 1.minute.ago)

    perform

    expect(client).not_to have_received(:generate_content)
    expect(described_class.jobs.size).to eq(1)
    expect(described_class.jobs.first['at']).to be_within(5).of(30.seconds.from_now.to_f)
  end

  it 'takes over a generation whose lease expired (crashed worker)' do
    report.update!(status: 'generating', generation_started_at: 10.minutes.ago)

    perform
    expect(report.reload).to be_complete
  end

  it 'exits quietly when the report was deleted (AC15)' do
    report.destroy

    expect { perform }.not_to raise_error
  end

  it 'refuses to mix tenants (AC19)' do
    other_vacancy = create(:vacancy)
    other_report = create(:fit_gap_report, portfolio:, vacancy: other_vacancy, status: 'pending')

    described_class.new.perform(portfolio.id, other_vacancy.id)

    expect(other_report.reload).to have_attributes(status: 'failed', skill_comparisons: other_report.skill_comparisons)
    expect(other_report.error_message).to include('different organization')
    expect(client).not_to have_received(:generate_content)
  end

  it 'fails clearly when the portfolio is not ready' do
    portfolio.update!(generation_status: 'generating')

    perform
    expect(report.reload).to have_attributes(status: 'failed', error_message: 'The candidate portfolio is not ready yet.')
  end

  it 'marks the report failed with a safe message and re-raises for Sidekiq retry (AC13)' do
    allow(FitGap::Comparator).to receive(:new).and_raise(NoMethodError, "undefined method for 'Kandidat Fiktif'")

    expect { perform }.to raise_error(NoMethodError)
    expect(report.reload).to have_attributes(status: 'failed',
                                             error_message: FitGap::ReportPresenter::FAILED_MESSAGE)
  end

  it 'leaves the report failed once retries are exhausted' do
    report.update!(status: 'generating')

    described_class.sidekiq_retries_exhausted_block.call({ 'args' => [portfolio.id, vacancy.id] }, StandardError.new)

    expect(report.reload).to be_failed
  end

  it 'computes as the owning tenant even if another tenant leaked into the thread' do
    RequestStore.store[:tenant_id] = create(:organization).id

    perform
    expect(report.reload).to be_complete
  end
end
