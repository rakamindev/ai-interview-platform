# frozen_string_literal: true

require "rails_helper"

RSpec.describe FitGapGeneratorWorker, type: :worker do
  describe "#perform" do
    let(:portfolio_id) { 101 }
    let(:vacancy_id) { 202 }
    let(:portfolio) { instance_double(Portfolio) }
    let(:vacancy) { instance_double(Vacancy) }
    let(:engine) { instance_double(FitGap::Engine) }

    before do
      allow(Portfolio).to receive(:find)
        .with(portfolio_id)
        .and_return(portfolio)

      allow(Vacancy).to receive(:unscoped).and_return(Vacancy)
      allow(Vacancy).to receive(:find)
        .with(vacancy_id)
        .and_return(vacancy)

      allow(FitGap::Engine).to receive(:new)
        .with(portfolio: portfolio, vacancy: vacancy)
        .and_return(engine)
    end

    it "generates the report using the requested portfolio and vacancy" do
      expect(engine).to receive(:call)

      described_class.new.perform(portfolio_id, vacancy_id)
    end

    it "re-raises engine errors so Sidekiq can retry" do
      allow(engine).to receive(:call)
        .and_raise(StandardError, "generation failed")

      expect(Rails.logger).to receive(:error).with(
        "[N13] FitGapGeneratorWorker failed for portfolio=#{portfolio_id} vacancy=#{vacancy_id}: StandardError: generation failed"
      )

      expect do
        described_class.new.perform(portfolio_id, vacancy_id)
      end.to raise_error(StandardError, "generation failed")
    end

    it "logs missing records without re-raising RecordNotFound" do
      allow(Portfolio).to receive(:find)
        .with(portfolio_id)
        .and_raise(ActiveRecord::RecordNotFound, "Portfolio not found")

      expect(Rails.logger).to receive(:warn)
        .with("[N13] Record not found: Portfolio not found")

      expect do
        described_class.new.perform(portfolio_id, vacancy_id)
      end.not_to raise_error
    end
  end
end
