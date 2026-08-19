# frozen_string_literal: true

require 'rails_helper'

RSpec.describe FitGapGeneratorWorker do
  describe '#perform' do
    let(:portfolio) { create(:portfolio, :with_skills) }
    let(:vacancy) { create(:vacancy, :with_skills) }

    before do
      allow_any_instance_of(FitGap::Engine).to receive(:call).and_return(
        create(:fit_gap_report, portfolio: portfolio, vacancy: vacancy)
      )
    end

    it 'calls FitGap::Engine' do
      expect_any_instance_of(FitGap::Engine).to receive(:call)
      described_class.new.perform(portfolio.id, vacancy.id)
    end

    it 'handles missing portfolio gracefully' do
      expect(Rails.logger).to receive(:warn).with(/Record not found/)
      described_class.new.perform(-1, vacancy.id)
    end
  end
end
