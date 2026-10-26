# frozen_string_literal: true

require 'rails_helper'

# F15: Prawn's built-in fonts only cover Windows-1252. Any other character in the PDF text —
# the generator's own "→" on overridden skills, or model/candidate text — used to raise and
# turn the export into a 500.
RSpec.describe Exports::PdfGenerator do
  let(:portfolio) { create(:portfolio) }
  let(:vacancy)   { create(:vacancy) }

  it 'exports a portfolio whose skill was overridden by an assessor' do
    skill = create(:portfolio_skill, portfolio: portfolio, ai_level: 2)
    create(:assessor_override, portfolio_skill: skill, override_level: 4, assessor_notes: 'Strong live demo')

    pdf = described_class.new(portfolio: portfolio).call

    expect(pdf).to start_with('%PDF')
  end

  it 'exports text outside Windows-1252 from the model or the candidate' do
    create(:portfolio_skill, portfolio: portfolio, skill_label: 'Kubernetes ☸', evidence: ['使用 Docker 🚀'],
                             competency_summary: 'Explains trade-offs → clearly')
    FitGapReport.create!(portfolio: portfolio, vacancy: vacancy, status: 'ready',
                         skill_comparisons: [{ 'skill_label' => 'Kubernetes ☸', 'expected_level' => 3,
                                               'candidate_level' => 2, 'result' => 'gap', 'delta' => -1 }],
                         overall_narrative: 'Kandidat “cukup baik” ✓')

    pdf = described_class.new(portfolio: portfolio, vacancy: vacancy).call

    expect(pdf).to start_with('%PDF')
  end
end
