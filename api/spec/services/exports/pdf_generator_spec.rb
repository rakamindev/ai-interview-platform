# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Exports::PdfGenerator do
  let(:organization) { create(:organization) }
  let(:assessment) { create(:assessment, organization:, name: 'Synthetic Assessment') }
  let(:session) { create(:session, organization:, assessment:) }
  let(:portfolio) { create(:portfolio, organization:, session:) }
  let(:vacancy) { create(:vacancy, organization:, role_title: 'Synthetic Role') }

  let(:comparison) do
    {
      'skill_id'      => 'ruby',
      'skill_label'   => 'Ruby',
      'required_level' => 4,
      'candidate_level' => 2,
      'result'        => 'gap',
      'delta'         => -2,
      'confidence'    => 'high',
      'assessment_state' => 'assessed',
      'is_override'   => false,
      'candidate_level_source' => 'ai'
    }
  end

  # Prawn writes each text line as a TJ array of hex-encoded runs, so the visible
  # strings are read back by decoding the runs of every array.
  def rendered_text(pdf)
    content = pdf.scan(/stream\r?\n(.*?)\r?\nendstream/m).flatten.join("\n")

    content.scan(/\[(.*?)\]\s*TJ/m).flatten.map do |block|
      block
        .scan(/<([0-9A-Fa-f]+)>/)
        .flatten
        .map { |hex| [hex].pack('H*') }
        .join
    end.join("\n")
  end

  describe 'fit/gap section' do
    it 'prints the required level from the canonical comparison contract' do
      create(:fit_gap_report, portfolio:, vacancy:, skill_comparisons: [comparison])

      pdf = described_class.new(portfolio:, vacancy:).call

      expect(pdf[0, 4]).to eq('%PDF')
      expect(rendered_text(pdf)).to include('L4')
      expect(rendered_text(pdf)).to include('L2')
    end

    it 'labels the required column with the vacancy requirement rather than a legacy key' do
      create(:fit_gap_report, portfolio:, vacancy:, skill_comparisons: [comparison])

      rows = described_class.new(portfolio:, vacancy:).send(:fit_gap_table_data, [comparison])

      expect(rows.first).to eq(['Skill', 'Required', 'Candidate', 'Result', 'Delta'])
      expect(rows.last[1]).to eq('L4')
      expect(rows.last[2]).to eq('L2')
      expect(rows.last[3]).to eq('Gap')
      expect(rows.last[4]).to eq('-2')
    end

    it 'prints an em dash for a skill that was never rated' do
      unrated = comparison.merge('candidate_level' => nil, 'result' => 'not_assessed', 'delta' => nil, 'required_level' => 3)
      create(:fit_gap_report, portfolio:, vacancy:, skill_comparisons: [unrated])

      rows = described_class.new(portfolio:, vacancy:).send(:fit_gap_table_data, [unrated])

      expect(rows.last[1]).to eq('L3')
      expect(rows.last[2]).to eq('—')
      expect(rows.last[4]).to eq('—')
    end

    it 'renders without a fit/gap section when no vacancy is given' do
      create(:fit_gap_report, portfolio:, vacancy:, skill_comparisons: [comparison])

      pdf = described_class.new(portfolio:).call

      expect(pdf[0, 4]).to eq('%PDF')
      expect(rendered_text(pdf)).not_to include('Required')
    end
  end

  describe 'portfolio section' do
    it 'renders an override beside the AI level' do
      skill = create(:portfolio_skill, portfolio:, skill_label: 'Ruby', ai_level: 3)
      create(:assessor_override, portfolio_skill: skill, override_level: 5)

      pdf = described_class.new(portfolio:).call
      text = rendered_text(pdf)

      expect(text).to include('Ruby')
      expect(text).to include('Override: L5')
    end

    it 'renders a portfolio with no skills instead of raising' do
      pdf = described_class.new(portfolio:).call

      expect(pdf[0, 4]).to eq('%PDF')
    end
  end
end
