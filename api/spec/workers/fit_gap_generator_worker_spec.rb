# frozen_string_literal: true

require "rails_helper"

RSpec.describe FitGapGeneratorWorker do
  let(:organization) { create(:organization) }
  let(:session)      { create(:session) }
  let(:portfolio)    { create(:portfolio, session: session, generation_status: "complete") }
  let(:vacancy)      { create(:vacancy, organization: organization) }
  let(:gemini_stub)  { Gemini::StubClient.new(mode: :valid) }

  before do
    allow_any_instance_of(FitGap::Engine).to receive(:gemini_client).and_return(gemini_stub)
  end

  describe "#perform" do
    it "creates a FitGapReport for the portfolio and vacancy" do
      expect do
        described_class.new.perform(portfolio.id, vacancy.id)
      end.to change(FitGapReport, :count).by(1)

      report = FitGapReport.last
      expect(report.portfolio_id).to eq(portfolio.id)
      expect(report.vacancy_id).to eq(vacancy.id)
      expect(report.skill_comparisons).to be_an(Array)
    end

    # AC-5.1: advisory lock prevents concurrent workers on same portfolio+vacancy
    it "acquires advisory lock before processing" do
      lock_acquired = false

      allow_any_instance_of(ActiveRecord::ConnectionAdapters::PostgreSQLAdapter)
        .to receive(:select_value) do |_conn, sql|
          if sql.include?("pg_try_advisory_lock")
            lock_acquired = true
            true
          else
            original = ActiveRecord::Base.connection
            original.select_value(sql)
          end
        end

      described_class.new.perform(portfolio.id, vacancy.id)
      expect(lock_acquired).to be true
    end

    # AC-5.2: skips processing if lock not acquired (concurrent worker racing)
    it "skips processing when advisory lock is not acquired" do
      allow_any_instance_of(ActiveRecord::ConnectionAdapters::PostgreSQLAdapter)
        .to receive(:select_value) do |_conn, sql|
          if sql.include?("pg_try_advisory_lock")
            false # lock held by another worker
          else
            original = ActiveRecord::Base.connection
            original.select_value(sql)
          end
        end

      expect do
        described_class.new.perform(portfolio.id, vacancy.id)
      end.not_to change(FitGapReport, :count)
    end

    # AC-5.3: advisory lock is released after processing
    it "releases advisory lock after successful processing" do
      unlock_called = false

      allow_any_instance_of(ActiveRecord::ConnectionAdapters::PostgreSQLAdapter)
        .to receive(:execute) do |_conn, sql|
          unlock_called = true if sql.include?("pg_advisory_unlock")
        end

      described_class.new.perform(portfolio.id, vacancy.id)
      expect(unlock_called).to be true
    end

    it "releases advisory lock even when an error occurs" do
      unlock_called = false

      allow_any_instance_of(ActiveRecord::ConnectionAdapters::PostgreSQLAdapter)
        .to receive(:execute) do |_conn, sql|
          unlock_called = true if sql.include?("pg_advisory_unlock")
        end

      allow_any_instance_of(FitGap::Engine).to receive(:call).and_raise(StandardError, "boom")

      expect do
        described_class.new.perform(portfolio.id, vacancy.id)
      end.to raise_error(StandardError, "boom")

      expect(unlock_called).to be true
    end

    it "logs and returns nil when record is not found" do
      expect(Rails.logger).to receive(:warn).with(/Record not found/)
      result = described_class.new.perform(-1, -1)
      expect(result).to be_nil
    end
  end
end
