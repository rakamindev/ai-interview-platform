# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Evaluations::Summary, type: :service do
  describe '#call' do
    context 'when every skill is confidently assessed' do
      it 'reports ready_for_review with full coverage and no reasons' do
        portfolio = build(:portfolio)
        portfolio.portfolio_skills.build(ai_level: 3, ai_confidence: 'high', evidence: ['Quote 1'], skill_label: 'A',
                                         competency_summary: 'x')
        portfolio.portfolio_skills.build(ai_level: 4, ai_confidence: 'high', evidence: ['Quote 2'], skill_label: 'B',
                                         competency_summary: 'x')

        summary = described_class.new(portfolio).call

        expect(summary[:overall_status]).to eq('ready_for_review')
        expect(summary[:needs_review]).to be(false)
        expect(summary[:review_reasons]).to be_empty
        expect(summary[:coverage]).to eq(total: 2, assessed: 2, percent: 100)
      end
    end

    context 'when a competency has no evidence' do
      it 'never assigns an artificial zero and flags needs_review' do
        portfolio = build(:portfolio)
        portfolio.portfolio_skills.build(ai_level: 3, ai_confidence: 'high', evidence: ['Quote'], skill_label: 'A',
                                         competency_summary: 'x')
        portfolio.portfolio_skills.build(ai_level: nil, evidence: [], skill_label: 'B', competency_summary: 'x')

        summary = described_class.new(portfolio).call

        expect(summary[:overall_status]).to eq('needs_review')
        expect(summary[:needs_review]).to be(true)
        expect(summary[:coverage]).to eq(total: 2, assessed: 1, percent: 50)
        expect(summary[:review_reasons]).to include(a_string_including('could not be assessed'))
      end
    end

    context 'when evidence is present but confidence is low' do
      it 'marks the skill partial and requests human review' do
        portfolio = build(:portfolio)
        portfolio.portfolio_skills.build(ai_level: 2, ai_confidence: 'low', evidence: ['Thin quote'], skill_label: 'A',
                                         competency_summary: 'x')

        summary = described_class.new(portfolio).call

        expect(summary[:overall_status]).to eq('needs_review')
        expect(summary[:coverage][:assessed]).to eq(0)
        expect(summary[:review_reasons]).to include(a_string_including('partial evidence'))
      end
    end

    context 'when a portfolio has no skills at all' do
      it 'reports needs_review with a clear reason' do
        portfolio = build(:portfolio)

        summary = described_class.new(portfolio).call

        expect(summary[:needs_review]).to be(true)
        expect(summary[:review_reasons]).to include('No skills were assessed')
        expect(summary[:coverage]).to eq(total: 0, assessed: 0, percent: 0)
      end
    end
  end

  describe '#status_for' do
    it 'maps assessed / partial / not_assessed deterministically' do
      portfolio = build(:portfolio)

      assessed = build(:portfolio_skill, portfolio:, ai_level: 3, ai_confidence: 'high', evidence: ['x'])
      partial  = build(:portfolio_skill, portfolio:, ai_level: 3, ai_confidence: 'low',  evidence: ['x'])
      missing  = build(:portfolio_skill, portfolio:, ai_level: nil, evidence: [])

      summary = described_class.new(portfolio)

      expect(summary.status_for(assessed)).to eq('assessed')
      expect(summary.status_for(partial)).to eq('partial')
      expect(summary.status_for(missing)).to eq('not_assessed')
    end
  end
end
