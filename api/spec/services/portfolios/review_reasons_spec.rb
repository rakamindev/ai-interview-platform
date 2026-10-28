# frozen_string_literal: true

require 'rails_helper'

# One rule for "this portfolio still needs a human" (AC-100, AC-101), used by
# the review queue and the candidate list. It reads the same presenters as the
# portfolio and fit/gap pages, so the counts cannot drift from what those
# pages show.
# Described by name and referenced inside the examples, so a missing class
# fails each example on its own instead of the whole file at load time.
RSpec.describe 'Portfolios::ReviewReasons' do # rubocop:disable RSpec/DescribeClass
  subject(:reasons) { review_reasons.reasons }

  def review_reasons
    Portfolios::ReviewReasons.new(portfolio.reload)
  end

  let(:portfolio) { create(:portfolio) }

  def codes
    reasons.to_h { |r| [r[:code], r[:count]] }
  end

  def skill(label, level: 3, confidence: 'high', discovered: false)
    create(:portfolio_skill, portfolio: portfolio, skill_label: label, ai_level: level,
                             ai_confidence: level ? confidence : nil, is_discovered: discovered,
                             rating_status: level ? 'assessed' : 'not_assessed',
                             not_assessed_reason: level ? nil : 'not_covered')
  end

  it 'is empty for a complete portfolio whose skills are all evidenced' do
    skill('Contoh Rails')

    expect(reasons).to eq([])
  end

  it 'counts configured low confidence skills that nobody reviewed (AC-100)' do
    skill('Contoh Rails', confidence: 'low')
    skill('Contoh SQL', confidence: 'low')
    skill('Contoh API')

    expect(codes).to eq('unreviewed_low_confidence' => 2)
  end

  it 'counts configured skills without a level and without an override (AC-100)' do
    skill('Contoh Docker', level: nil)

    expect(codes).to eq('unreviewed_not_assessed' => 1)
  end

  it 'drops a skill once an assessor confirmed or overrode it (AC-100)' do
    low = skill('Contoh Rails', confidence: 'low')
    missing = skill('Contoh Docker', level: nil)
    PortfolioSkills::OverrideActions.new(low, actor_id: 1).confirm(notes: 'Contoh catatan konfirmasi.')
    PortfolioSkills::OverrideActions.new(missing, actor_id: 1).set(level: 2, notes: 'Contoh catatan override.')

    expect(reasons).to eq([])
  end

  it 'ignores discovered skills, like the portfolio summary does' do
    skill('Contoh Kubernetes', confidence: 'low', discovered: true)

    expect(reasons).to eq([])
  end

  it 'flags a legacy portfolio (AC-101)' do
    portfolio.update!(ratings_validated: false)
    skill('Contoh Rails')

    expect(codes).to eq('legacy_ratings' => 1)
  end

  it 'flags a failed portfolio and nothing else (AC-101)' do
    portfolio.update!(generation_status: 'failed', generated_at: nil)

    expect(codes).to eq('generation_failed' => 1)
  end

  it 'flags a complete portfolio without any skill (AC-101)' do
    expect(codes).to eq('empty_portfolio' => 1)
  end

  it 'sends an empty portfolio to the portfolio page' do
    expect(review_reasons.target).to eq(page: 'portfolio', vacancy_id: nil)
  end

  it 'has no reason while the portfolio is still being generated' do
    portfolio.update!(generation_status: 'generating', generated_at: nil)

    expect(reasons).to eq([])
  end

  context 'with fit/gap narratives (AC-101)' do
    let(:vacancy) { create(:vacancy) }

    before do
      skill('Contoh Rails')
      create(:vacancy_skill, vacancy: vacancy, skill_label: 'Contoh Rails', expected_level: 3)
    end

    def current_digest
      FitGap::ReportPresenter.new(portfolio: portfolio.reload, vacancy: vacancy).input_digest
    end

    it 'counts a failed narrative' do
      create(:fit_gap_report, portfolio: portfolio, vacancy: vacancy, status: 'failed')

      expect(codes).to eq('narrative_failed' => 1)
    end

    it 'counts a narrative whose ratings changed since it was written' do
      create(:fit_gap_report, portfolio: portfolio, vacancy: vacancy, status: 'complete',
                              narrative_source: 'ai', input_digest: 'contoh-digest-lama')

      expect(codes).to eq('narrative_outdated' => 1)
    end

    it 'does not count a narrative that matches the current ratings' do
      create(:fit_gap_report, portfolio: portfolio, vacancy: vacancy, status: 'complete',
                              narrative_source: 'ai', input_digest: current_digest)

      expect(reasons).to eq([])
    end
  end

  describe '#target' do
    it 'sends narrative-only reviews to the fit/gap report of that vacancy' do
      vacancy = create(:vacancy)
      skill('Contoh Rails')
      create(:fit_gap_report, portfolio: portfolio, vacancy: vacancy, status: 'failed')

      expect(review_reasons.target).to eq(page: 'fitgap', vacancy_id: vacancy.id)
    end

    it 'sends skill reviews to the portfolio' do
      skill('Contoh Rails', confidence: 'low')

      expect(review_reasons.target).to eq(page: 'portfolio', vacancy_id: nil)
    end
  end

  describe '#waiting_since' do
    it 'is when the portfolio was generated' do
      portfolio.update!(generated_at: Time.zone.parse('2026-10-20 08:00:00 UTC'))

      expect(review_reasons.waiting_since).to eq(Time.zone.parse('2026-10-20 08:00:00 UTC'))
    end

    it 'falls back to when the interview ended for a failed portfolio' do
      portfolio.update!(generation_status: 'failed', generated_at: nil)
      portfolio.session.update!(ended_at: Time.zone.parse('2026-10-21 09:00:00 UTC'))

      expect(review_reasons.waiting_since).to eq(Time.zone.parse('2026-10-21 09:00:00 UTC'))
    end
  end
end
