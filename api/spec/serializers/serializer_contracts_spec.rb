# frozen_string_literal: true

require 'rails_helper'

# Verifies every serializer's output against the SAME key-sets used by the
# API contract specs (ResponseContracts). If a serializer and its endpoint
# drift apart, this fails at the unit level — faster feedback than the
# request-level contract specs.
RSpec.describe 'Serializer response contracts', type: :serializer do
  describe SessionSerializer do
    it 'matches ResponseContracts::SESSION_KEYS' do
      result = described_class.new(build(:session)).as_json
      expect(result.keys.map(&:to_s).sort).to eq(ResponseContracts::SESSION_KEYS.map(&:to_s).sort)
    end

    it 'matches ResponseContracts::SESSION_WITH_ASSESSMENT_KEYS when include_assessment' do
      session = create(:session, :active)
      result  = described_class.new(session, include_assessment: true).as_json
      expect(result.keys.map(&:to_s).sort).to eq(ResponseContracts::SESSION_WITH_ASSESSMENT_KEYS.map(&:to_s).sort)
    end
  end

  describe AssessmentSerializer do
    it 'matches ResponseContracts::ASSESSMENT_KEYS' do
      result = described_class.new(build(:assessment)).as_json
      expect(result.keys.map(&:to_s).sort).to eq(ResponseContracts::ASSESSMENT_KEYS.map(&:to_s).sort)
    end

    it 'adds skills matching ResponseContracts::ASSESSMENT_SKILL_KEYS when with_skills' do
      assessment = create(:assessment, :with_skills)
      result = described_class.new(assessment, with_skills: true).as_json
      expect(result.keys.map(&:to_s).sort).to eq((ResponseContracts::ASSESSMENT_KEYS + [:skills]).map(&:to_s).sort)
      expect(result[:skills].first.keys.map(&:to_s).sort)
        .to eq(ResponseContracts::ASSESSMENT_SKILL_KEYS.map(&:to_s).sort)
    end
  end

  describe VacancySerializer do
    it 'matches ResponseContracts::VACANCY_KEYS' do
      result = described_class.new(build(:vacancy)).as_json
      expect(result.keys.map(&:to_s).sort).to eq(ResponseContracts::VACANCY_KEYS.map(&:to_s).sort)
    end

    it 'adds skills matching ResponseContracts::VACANCY_SKILL_KEYS when with_skills' do
      vacancy = create(:vacancy, :with_skills)
      result = described_class.new(vacancy, with_skills: true).as_json
      expect(result.keys.map(&:to_s).sort).to eq((ResponseContracts::VACANCY_KEYS + [:skills]).map(&:to_s).sort)
      expect(result[:skills].first.keys.map(&:to_s).sort)
        .to eq(ResponseContracts::VACANCY_SKILL_KEYS.map(&:to_s).sort)
    end
  end

  describe PortfolioSerializer do
    it 'matches ResponseContracts::PORTFOLIO_KEYS with nested skills and overrides' do
      session   = create(:session, :ended)
      portfolio = create(:portfolio, :complete, session: session)
      create(:portfolio_skill, portfolio: portfolio)

      result = described_class.new(portfolio.reload).as_json

      expect(result.keys.map(&:to_s).sort).to eq(ResponseContracts::PORTFOLIO_KEYS.map(&:to_s).sort)
      expect(result[:skills].first.keys.map(&:to_s).sort)
        .to eq(ResponseContracts::PORTFOLIO_SKILL_KEYS.map(&:to_s).sort)
    end
  end

  describe AssessorOverrideSerializer do
    it 'matches ResponseContracts::OVERRIDE_KEYS' do
      session   = create(:session, :ended)
      portfolio = create(:portfolio, :complete, session: session)
      skill     = create(:portfolio_skill, portfolio: portfolio)
      override  = create(:assessor_override, portfolio_skill: skill)

      result = described_class.new(override).as_json
      expect(result.keys.map(&:to_s).sort).to eq(ResponseContracts::OVERRIDE_KEYS.map(&:to_s).sort)
    end
  end

  describe SkillTaxonomySerializer do
    it 'matches ResponseContracts::TAXONOMY_KEYS' do
      result = described_class.new(build(:skill_taxonomy)).as_json
      expect(result.keys.map(&:to_s).sort).to eq(ResponseContracts::TAXONOMY_KEYS.map(&:to_s).sort)
    end
  end

  describe CoverageMapSerializer do
    it 'matches ResponseContracts::COVERAGE_MAP_KEYS' do
      session = create(:session, :active)
      map     = create(:coverage_map, session: session)

      result = described_class.new(map).as_json
      expect(result.keys.map(&:to_s).sort).to eq(ResponseContracts::COVERAGE_MAP_KEYS.map(&:to_s).sort)
    end
  end

  describe TranscriptTurnSerializer do
    it 'matches ResponseContracts::TRANSCRIPT_TURN_KEYS' do
      session = create(:session, :active)
      turn    = create(:transcript_turn, session: session)

      result = described_class.new(turn).as_json
      expect(result.keys.map(&:to_s).sort).to eq(ResponseContracts::TRANSCRIPT_TURN_KEYS.map(&:to_s).sort)
    end
  end

  describe FitGapReportSerializer do
    it 'matches ResponseContracts::FIT_GAP_REPORT_KEYS' do
      session   = create(:session, :ended)
      portfolio = create(:portfolio, :complete, session: session)
      vacancy   = create(:vacancy)
      report    = create(:fit_gap_report, portfolio: portfolio, vacancy: vacancy)

      result = described_class.new(report).as_json
      expect(result.keys.map(&:to_s).sort).to eq(ResponseContracts::FIT_GAP_REPORT_KEYS.map(&:to_s).sort)
    end
  end
end
