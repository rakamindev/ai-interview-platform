# frozen_string_literal: true

require 'rails_helper'

# Fit/gap comparisons are computed on read from the current portfolio,
# assessor decisions and vacancy (D-3, D-5). Only measured, sufficiently
# evidenced levels count toward fit (Q1).
RSpec.describe FitGap::ReportPresenter do
  subject(:json) { described_class.new(portfolio: portfolio, vacancy: vacancy).as_json }

  let(:portfolio) { create(:portfolio) }
  let(:vacancy)   { create(:vacancy) }

  def require_skill(label, level)
    create(:vacancy_skill, vacancy: vacancy, skill_label: label, expected_level: level)
  end

  def rated(label, level, confidence: 'high')
    create(:portfolio_skill, portfolio: portfolio, skill_label: label, ai_level: level, ai_confidence: confidence)
  end

  def row(label)
    json[:comparisons].find { |c| c[:skill_label] == label }
  end

  it 'computes match, exceed and gap for evidenced AI levels (AC-42)' do
    { 'Rails' => [3, 3], 'API' => [2, 4], 'SQL' => [3, 2] }.each do |label, (expected, actual)|
      require_skill(label, expected)
      rated(label, actual)
    end

    expect(json[:comparisons].map { |c| c.slice(:skill_label, :result, :delta, :level_source, :counts_toward_fit) })
      .to contain_exactly(
        { skill_label: 'Rails', result: 'match', delta: 0, level_source: 'ai', counts_toward_fit: true },
        { skill_label: 'API', result: 'exceed', delta: 2, level_source: 'ai', counts_toward_fit: true },
        { skill_label: 'SQL', result: 'gap', delta: -1, level_source: 'ai', counts_toward_fit: true }
      )
  end

  it 'lists a vacancy skill missing from the portfolio as not assessed, not counted, for follow-up (AC-40)' do
    require_skill('System Design', 4)

    expect(row('System Design')).to include(result: 'not_assessed', candidate_level: nil, expected_level: 4,
                                            counts_toward_fit: false, not_assessed_reason: 'not_covered')
    expect(json[:follow_up]).to eq(['System Design'])
    expect(json[:summary]).to include(not_assessed: 1, evidenced: 0, gap: 0)
  end

  it 'treats a not-assessed portfolio skill as not assessed, keeping its reason' do
    require_skill('Rails', 3)
    create(:portfolio_skill, portfolio: portfolio, skill_label: 'Rails', ai_level: nil, ai_confidence: nil,
                             rating_status: 'not_assessed', not_assessed_reason: 'no_evidence', evidence: [])

    expect(row('Rails')).to include(result: 'not_assessed', not_assessed_reason: 'no_evidence', counts_toward_fit: false)
  end

  describe 'low confidence is never counted, in any direction (AC-41, AC-52, AC-53)' do
    { 'below' => [3, 2], 'equal' => [3, 3], 'above' => [3, 5] }.each do |direction, (expected, actual)|
      it "marks a low-confidence AI level #{direction} the requirement as low_confidence" do
        require_skill('Rails', expected)
        rated('Rails', actual, confidence: 'low')

        expect(row('Rails')).to include(result: 'low_confidence', tentative_direction: direction,
                                        counts_toward_fit: false, confidence: 'low')
        expect(json[:follow_up]).to eq(['Rails'])
        expect(json[:summary]).to include(low_confidence: 1, match: 0, exceed: 0, gap: 0, evidenced: 0)
      end
    end
  end

  describe 'human review (level_source)' do
    let!(:skill) do
      require_skill('SQL', 3)
      rated('SQL', 2, confidence: 'low')
    end

    it 'uses the assessor override, drops AI confidence and counts it (AC-43, AC-54)' do
      PortfolioSkills::OverrideActions.new(skill, actor_id: 7).set(level: 3, notes: 'Contoh: tugas tertulis.')

      expect(row('SQL')).to include(candidate_level: 3, ai_level: 2, level_source: 'assessor_override',
                                    is_override: true, override_notes: 'Contoh: tugas tertulis.',
                                    confidence: nil, result: 'match', counts_toward_fit: true)
      expect(json[:summary]).to include(overridden: 1, match: 1, low_confidence: 0)
    end

    it 'marks an AI level confirmed by an assessor as human reviewed and counts it' do
      PortfolioSkills::OverrideActions.new(skill, actor_id: 7).confirm(notes: 'Contoh: bukti cukup dari studi kasus.')

      expect(row('SQL')).to include(candidate_level: 2, ai_level: 2, level_source: 'assessor_confirmed',
                                    is_override: false, result: 'gap', counts_toward_fit: true)
      expect(json[:summary]).to include(confirmed: 1, gap: 1, low_confidence: 0)
    end

    it 'goes back to the AI level after a revert' do
      actions = PortfolioSkills::OverrideActions.new(skill, actor_id: 7)
      actions.set(level: 3, notes: 'Contoh.')
      actions.revert(notes: 'Contoh: salah input.')

      expect(row('SQL')).to include(level_source: 'ai', is_override: false, result: 'low_confidence')
    end
  end

  it 'reports zero evidenced skills and no fit totals for a portfolio without skills (AC-48)' do
    require_skill('Rails', 3)
    require_skill('API', 2)

    expect(json[:summary]).to include(total: 2, evidenced: 0, not_assessed: 2, match: 0, exceed: 0, gap: 0)
  end

  describe 'narrative state' do
    before do
      require_skill('Rails', 3)
      rated('Rails', 3)
    end

    it 'is not_requested without a report (AC-45)' do
      expect(json[:narrative]).to include(status: 'not_requested', source: nil)
    end

    it 'is complete and labelled as AI generated when the inputs did not change (AC-51)' do
      digest = described_class.new(portfolio: portfolio, vacancy: vacancy).input_digest
      create(:fit_gap_report, portfolio: portfolio, vacancy: vacancy, status: 'complete', narrative_source: 'ai',
                              input_digest: digest, overall_narrative: 'Contoh narasi.')

      expect(json[:narrative]).to include(status: 'complete', source: 'ai', overall: 'Contoh narasi.',
                                          label: 'AI generated, not a hiring decision')
    end

    it 'is outdated once a rating changes after the narrative was written (AC-44)' do
      digest = described_class.new(portfolio: portfolio, vacancy: vacancy).input_digest
      create(:fit_gap_report, portfolio: portfolio, vacancy: vacancy, status: 'complete', narrative_source: 'ai',
                              input_digest: digest, overall_narrative: 'Contoh narasi.')
      PortfolioSkills::OverrideActions.new(portfolio.portfolio_skills.first, actor_id: 7)
                                      .set(level: 4, notes: 'Contoh.')

      expect(json[:narrative][:status]).to eq('outdated')
    end
  end
end
