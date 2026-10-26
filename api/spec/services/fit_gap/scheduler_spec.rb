# frozen_string_literal: true

require 'rails_helper'

RSpec.describe FitGap::Scheduler do
  let(:scenario) { build_fit_gap_scenario }
  let(:portfolio) { scenario[:portfolio] }
  let(:vacancy) { scenario[:vacancy] }

  def request(force: false) = described_class.request(portfolio:, vacancy:, force:)
  def jobs = FitGapGeneratorWorker.jobs
  def current_digest = FitGap::Inputs.new(portfolio: portfolio.reload, vacancy:).digest

  it 'creates a pending report and enqueues one job on first request (AC8)' do
    report = request

    expect(report).to have_attributes(status: 'pending', skill_comparisons: [])
    expect(jobs.map { |j| j['args'] }).to eq([[portfolio.id, vacancy.id]])
  end

  it 'does not re-enqueue a pending job that is still within its lease' do
    create(:fit_gap_report, portfolio:, vacancy:, status: 'pending', queued_at: 1.minute.ago)

    request(force: true)
    expect(jobs).to be_empty
  end

  it 'collapses repeated requests into one job while in flight (AC9, AC14)' do
    3.times { request }

    expect(jobs.size).to eq(1)
    expect(FitGapReport.count).to eq(1)
  end

  it 'does not enqueue while another job holds a live generation lease' do
    create(:fit_gap_report, portfolio:, vacancy:, status: 'generating', generation_started_at: 1.minute.ago)

    request(force: true)
    expect(jobs).to be_empty
  end

  it 're-enqueues when a pending job appears lost (lease expired)' do
    create(:fit_gap_report, portfolio:, vacancy:, status: 'pending', queued_at: 10.minutes.ago)

    request
    expect(jobs.size).to eq(1)
  end

  it 're-enqueues when a generating job died (lease expired)' do
    create(:fit_gap_report, portfolio:, vacancy:, status: 'generating', generation_started_at: 10.minutes.ago)

    request
    expect(jobs.size).to eq(1)
  end

  it 'returns an up-to-date report without enqueuing (AC10)' do
    create(:fit_gap_report, portfolio:, vacancy:, status: 'complete', inputs_digest: current_digest)

    expect(request).to be_complete
    expect(jobs).to be_empty
  end

  it 'regenerates an up-to-date report only when forced' do
    create(:fit_gap_report, portfolio:, vacancy:, status: 'complete', inputs_digest: current_digest)

    expect(request(force: true)).to be_pending
    expect(jobs.size).to eq(1)
  end

  it 'refreshes an outdated report but keeps its previous rows visible (AC11)' do
    old_rows = [{ 'skill_label' => 'Communication', 'result' => 'gap' }]
    create(:fit_gap_report, portfolio:, vacancy:, status: 'complete', inputs_digest: 'old', skill_comparisons: old_rows)

    report = request
    expect(report).to have_attributes(status: 'pending', skill_comparisons: old_rows)
    expect(jobs.size).to eq(1)
  end

  it 'retries a failed report and clears the error' do
    create(:fit_gap_report, portfolio:, vacancy:, status: 'failed', error_message: 'boom', inputs_digest: current_digest)

    expect(request).to have_attributes(status: 'pending', error_message: nil)
    expect(jobs.size).to eq(1)
  end

  it 'survives losing the insert race to a concurrent request' do
    create(:fit_gap_report, portfolio:, vacancy:, status: 'pending', queued_at: Time.current) # the winner
    allow(FitGapReport).to receive(:find_or_create_by!).and_raise(ActiveRecord::RecordNotUnique)

    expect { request }.not_to raise_error
    expect(FitGapReport.count).to eq(1)
    expect(jobs).to be_empty
  end
end
