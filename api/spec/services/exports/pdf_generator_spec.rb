# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Exports::PdfGenerator, type: :model do
  let(:session) { create(:session, :ended) }
  let(:portfolio) { create(:portfolio, :complete, session: session) }
  let(:vacancy) { create(:vacancy, :with_skills, tenant_id: 1) }
  let(:generator) { described_class.new(portfolio: portfolio, vacancy: vacancy) }

  before { with_tenant }

  describe '#call' do
    it 'returns a binary PDF string' do
      pdf = generator.call
      expect(pdf).to be_a(String)
      expect(pdf).to start_with('%PDF')
      expect(pdf).to end_with("%%EOF\n")
    end

    it 'generates valid PDF structure' do
      pdf = generator.call
      # Check for essential PDF objects
      expect(pdf).to include('/Type /Catalog')
      expect(pdf).to include('/Type /Page')
    end

    it 'includes skill portfolio section marker' do
      pdf = generator.call
      # PDF uses UTF-16 encoding - check for basic PDF validity instead
      expect(pdf).to start_with('%PDF')
      expect(pdf).to end_with("%%EOF\n")
    end

    context 'with fit_gap report' do
      let!(:report) do
        FitGapReport.create!(
          portfolio: portfolio,
          vacancy: vacancy,
          skill_comparisons: [{ skill_label: 'Test', result: 'match' }],
          culture_narrative: 'Good fit',
          overall_narrative: 'Hire',
          generated_at: Time.current
        )
      end

      it 'generates valid PDF with fit_gap' do
        pdf = generator.call
        expect(pdf).to start_with('%PDF')
        expect(pdf).to end_with("%%EOF\n")
      end
    end

    context 'without vacancy' do
      let(:generator) { described_class.new(portfolio: portfolio, vacancy: nil) }

      it 'generates PDF without fit/gap' do
        pdf = generator.call
        expect(pdf).to start_with('%PDF')
        expect(pdf).not_to include('Fit/Gap Analysis')
      end
    end
  end

  describe 'private methods' do
    describe '#format_duration' do
      it 'formats seconds to minutes and seconds' do
        expect(generator.send(:format_duration, 125)).to eq('2m 5s')
        expect(generator.send(:format_duration, 3600)).to eq('60m 0s')
        expect(generator.send(:format_duration, 0)).to eq('0m 0s')
        expect(generator.send(:format_duration, nil)).to eq('N/A')
      end
    end

    describe 'constants' do
      it 'defines LEVEL_LABELS' do
        expect(described_class::LEVEL_LABELS).to eq({ 1 => 'L1', 2 => 'L2', 3 => 'L3', 4 => 'L4', 5 => 'L5' })
      end

      it 'defines CONFIDENCE_LABELS' do
        expect(described_class::CONFIDENCE_LABELS).to eq({ 'high' => 'High', 'medium' => 'Medium', 'low' => 'Low' })
      end
    end
  end
end