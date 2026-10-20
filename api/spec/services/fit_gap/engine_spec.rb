# frozen_string_literal: true

require 'rails_helper'

RSpec.describe FitGap::Engine do
  let(:session)   { create(:session, :ended, end_reason: 'time_ceiling') }
  let(:portfolio) { create(:portfolio, session: session) }
  let(:vacancy)   { create(:vacancy, tenant_id: session.tenant_id) }
  let(:narrative) { { 'culture_narrative' => 'Culture text.', 'overall_narrative' => 'Recommend.' } }
  let(:client)    { FakeGeminiClient.new(response: narrative) }

  def run
    described_class.new(portfolio: portfolio, vacancy: vacancy, gemini_client: client).call
  end

  def comparison(report, label)
    report.skill_comparisons.find { |c| c['skill_label'] == label }
  end

  describe 'skill comparisons (AC6)' do
    before do
      create(:vacancy_skill, vacancy: vacancy, skill_label: 'React', expected_level: 3)
      create(:vacancy_skill, vacancy: vacancy, skill_label: 'REST', expected_level: 3)
      create(:vacancy_skill, vacancy: vacancy, skill_label: 'SQL', expected_level: 2)
    end

    it 'classifies match, gap and exceed from the effective level' do
      create(:portfolio_skill, portfolio: portfolio, skill_label: 'React', ai_level: 3)
      create(:portfolio_skill, portfolio: portfolio, skill_label: 'REST', ai_level: 2)
      create(:portfolio_skill, portfolio: portfolio, skill_label: 'SQL', ai_level: 4)

      report = run

      expect(comparison(report, 'React')).to include('result' => 'match', 'delta' => 0, 'expected_level' => 3, 'candidate_level' => 3)
      expect(comparison(report, 'REST')).to include('result' => 'gap', 'delta' => -1)
      expect(comparison(report, 'SQL')).to include('result' => 'exceed', 'delta' => 2)
    end

    it 'reports a not-assessed skill as not_assessed, never as a gap' do
      create(:portfolio_skill, :not_assessed, portfolio: portfolio, skill_label: 'React')

      expect(comparison(run, 'React')).to include('result' => 'not_assessed', 'candidate_level' => nil,
                                                  'delta' => nil, 'ai_level' => nil, 'expected_level' => 3)
    end

    it 'applies an assessor override even when the AI did not assess the skill' do
      skill = create(:portfolio_skill, :not_assessed, portfolio: portfolio, skill_label: 'React')
      create(:assessor_override, portfolio_skill: skill, ai_level: nil, override_level: 4)

      expect(comparison(run, 'React')).to include('result' => 'exceed', 'candidate_level' => 4,
                                                  'ai_level' => nil, 'is_override' => true)
    end

    it 'marks skills without an override as not overridden' do
      create(:portfolio_skill, portfolio: portfolio, skill_label: 'React', ai_level: 3)

      expect(comparison(run, 'React')).to include('is_override' => false, 'confidence' => 'high')
    end
  end

  describe 'evidence gate (AC13)' do
    before { create(:vacancy_skill, vacancy: vacancy, skill_label: 'React', expected_level: 3) }

    it 'is sufficient and asks the model for narratives when every skill is evidenced' do
      create(:portfolio_skill, portfolio: portfolio, skill_label: 'React', ai_level: 3, ai_confidence: 'high')

      report = run

      expect(report.recommendation_status).to eq('sufficient')
      expect(report.evidence_gaps).to eq([])
      expect(report.overall_narrative).to eq('Recommend.')
      expect(client).to be_called
    end

    shared_examples 'insufficient evidence' do |reason|
      it "withholds the recommendation (#{reason}) without calling the model" do
        report = run

        expect(report.recommendation_status).to eq('insufficient_evidence')
        expect(report.evidence_gaps.map { |g| g['reason'] }).to include(reason)
        expect(report.overall_narrative).to be_nil
        expect(report.culture_narrative).to be_nil
        expect(client).not_to be_called
      end
    end

    context 'when a required skill was not assessed' do
      before { create(:portfolio_skill, :not_assessed, portfolio: portfolio, skill_label: 'React') }

      include_examples 'insufficient evidence', 'skills_not_assessed'

      it 'names the skills that block the recommendation' do
        gap = run.evidence_gaps.find { |g| g['reason'] == 'skills_not_assessed' }

        expect(gap['skills']).to eq(['React'])
      end
    end

    context 'when the portfolio has no rating for a required skill at all' do
      include_examples 'insufficient evidence', 'skills_not_assessed'
    end

    context 'when a rating has low confidence and no override' do
      before { create(:portfolio_skill, portfolio: portfolio, skill_label: 'React', ai_level: 1, ai_confidence: 'low') }

      include_examples 'insufficient evidence', 'low_confidence'
    end

    context 'when the candidate ended the interview' do
      let(:session) { create(:session, :ended, end_reason: 'manual_candidate') }

      before { create(:portfolio_skill, portfolio: portfolio, skill_label: 'React', ai_level: 3) }

      include_examples 'insufficient evidence', 'interview_incomplete'
    end

    context 'when the interview ended with an error' do
      let(:session) { create(:session, :ended, end_reason: 'error') }

      before { create(:portfolio_skill, portfolio: portfolio, skill_label: 'React', ai_level: 3) }

      include_examples 'insufficient evidence', 'interview_incomplete'
    end

    it 'treats an assessor override as human evidence that clears the gate for that skill' do
      skill = create(:portfolio_skill, portfolio: portfolio, skill_label: 'React', ai_level: 1, ai_confidence: 'low')
      create(:assessor_override, portfolio_skill: skill, override_level: 3)

      expect(run.recommendation_status).to eq('sufficient')
    end

    it 'reproduces session 1: a 3-minute interview with a low-confidence L1 gets no verdict' do
      session.update!(end_reason: 'manual_candidate', duration_seconds: 199)
      create(:portfolio_skill, portfolio: portfolio, skill_label: 'React', ai_level: 1, ai_confidence: 'low')

      report = run

      expect(report.recommendation_status).to eq('insufficient_evidence')
      expect(report.evidence_gaps.map { |g| g['reason'] }).to contain_exactly('low_confidence', 'interview_incomplete')
      expect(report.overall_narrative).to be_nil
    end
  end

  describe 'vacancy with no skills (AC7)' do
    it 'produces an empty report instead of failing validation' do
      report = run

      expect(report).to be_persisted
      expect(report.skill_comparisons).to eq([])
      expect(report.evidence_gaps.map { |g| g['reason'] }).to eq(['no_vacancy_skills'])
    end
  end

  it 'falls back to a factual summary when the narrative call fails' do
    create(:vacancy_skill, vacancy: vacancy, skill_label: 'React', expected_level: 3)
    create(:portfolio_skill, portfolio: portfolio, skill_label: 'React', ai_level: 3)

    report = described_class.new(portfolio: portfolio, vacancy: vacancy,
                                 gemini_client: FakeGeminiClient.new(error: Gemini::HttpClient::ApiError.new('503'))).call

    expect(report.recommendation_status).to eq('sufficient')
    expect(report.overall_narrative).to include('1 skill match')
  end

  it 'regenerates in place instead of creating a second report' do
    create(:vacancy_skill, vacancy: vacancy, skill_label: 'React', expected_level: 3)
    create(:portfolio_skill, portfolio: portfolio, skill_label: 'React', ai_level: 3)

    expect { 2.times { run } }.to change(FitGapReport, :count).by(1)
  end
end
