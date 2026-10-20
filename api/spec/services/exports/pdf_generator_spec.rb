# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Exports::PdfGenerator do
  let(:portfolio) { create(:portfolio) }
  let(:vacancy)   { create(:vacancy, tenant_id: portfolio.session.tenant_id, role_title: 'Frontend Engineer') }

  def pdf_text(vacancy: nil)
    data = described_class.new(portfolio: portfolio, vacancy: vacancy).call
    PDF::Reader.new(StringIO.new(data)).pages.map(&:text).join("\n").squeeze(' ')
  end

  it 'exports a portfolio that has an assessor override (AC10)' do
    skill = create(:portfolio_skill, portfolio: portfolio, skill_label: 'React', ai_level: 2)
    create(:assessor_override, portfolio_skill: skill, override_level: 4)

    expect(pdf_text).to include('Level: L4 (AI: L2 -> Override: L4)')
  end

  it 'exports text outside the PDF font charset instead of crashing' do
    create(:portfolio_skill, portfolio: portfolio, skill_label: 'React',
                             evidence: ['Saya pakai “useMemo” → lebih cepat 🚀 日本'],
                             competency_summary: 'Kuat di state management — konsisten.')

    text = pdf_text

    expect(text).to include('Saya pakai')
    expect(text).to include('-> lebih cepat')
    expect(text).to include('Kuat di state management')
  end

  it 'shows not-assessed skills as such, never as a level' do
    create(:portfolio_skill, :not_assessed, portfolio: portfolio, skill_label: 'Cloud Infrastructure')

    text = pdf_text

    expect(text).to include('Cloud Infrastructure')
    expect(text).to include('Not assessed')
    expect(text).not_to match(/Cloud Infrastructure\s+Level: L/)
  end

  it 'shows an assessor rating for a skill the AI did not assess' do
    skill = create(:portfolio_skill, :not_assessed, portfolio: portfolio, skill_label: 'Cloud Infrastructure')
    create(:assessor_override, portfolio_skill: skill, ai_level: nil, override_level: 2)

    expect(pdf_text).to include('Level: L2 (AI: Not assessed -> Override: L2)')
  end

  describe 'fit/gap section' do
    let(:comparisons) do
      [{ 'skill_label' => 'React', 'expected_level' => 3, 'candidate_level' => nil, 'result' => 'not_assessed', 'delta' => nil }]
    end

    it 'states the evidence status instead of a recommendation when the gate withheld it (AC13)' do
      FitGapReport.create!(portfolio: portfolio, vacancy: vacancy, skill_comparisons: comparisons,
                           recommendation_status: 'insufficient_evidence',
                           evidence_gaps: [{ 'reason' => 'skills_not_assessed', 'skills' => ['React'] },
                                           { 'reason' => 'interview_incomplete', 'skills' => [] }])

      text = pdf_text(vacancy: vacancy)

      expect(text).to include('No recommendation: insufficient evidence')
      expect(text).to include('Not assessed in the interview: React')
      expect(text).to include('The interview ended before it was complete')
      expect(text).not_to include('Overall Assessment')
    end

    it 'flags reports generated before the evidence gate existed' do
      FitGapReport.create!(portfolio: portfolio, vacancy: vacancy, skill_comparisons: comparisons,
                           recommendation_status: nil, overall_narrative: 'We do not recommend proceeding.')

      expect(pdf_text(vacancy: vacancy)).to include('Generated before evidence checks were introduced')
    end

    it 'shows the recommendation when the evidence is sufficient' do
      FitGapReport.create!(portfolio: portfolio, vacancy: vacancy, recommendation_status: 'sufficient',
                           skill_comparisons: comparisons.map { |c| c.merge('candidate_level' => 3, 'result' => 'match', 'delta' => 0) },
                           culture_narrative: 'Fits an async team.', overall_narrative: 'Proceed to the next round.')

      text = pdf_text(vacancy: vacancy)

      expect(text).to include('Overall Assessment')
      expect(text).to include('Proceed to the next round.')
    end
  end
end
