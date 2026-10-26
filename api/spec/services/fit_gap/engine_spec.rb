# frozen_string_literal: true

require 'rails_helper'

# Baseline: pins what the engine does correctly today, before the revamp.
RSpec.describe FitGap::Engine do
  let(:vacancy)   { create(:vacancy) }
  let(:portfolio) { create(:portfolio) }
  let(:gemini) do
    FakeGeminiClient.new(response: { 'culture_narrative' => 'Culture text', 'overall_narrative' => 'Overall text' })
  end

  def comparison_for(report, label)
    report.skill_comparisons.find { |c| c['skill_label'] == label }
  end

  it 'classifies each vacancy skill as match, gap or exceed against the candidate level' do
    create(:vacancy_skill, vacancy: vacancy, skill_label: 'Communication', expected_level: 3)
    create(:vacancy_skill, vacancy: vacancy, skill_label: 'SQL',           expected_level: 4)
    create(:vacancy_skill, vacancy: vacancy, skill_label: 'Testing',       expected_level: 2)
    create(:portfolio_skill, portfolio: portfolio, skill_label: 'Communication', ai_level: 3)
    create(:portfolio_skill, portfolio: portfolio, skill_label: 'SQL',           ai_level: 2)
    create(:portfolio_skill, portfolio: portfolio, skill_label: 'Testing',       ai_level: 5)

    report = described_class.new(portfolio: portfolio, vacancy: vacancy, gemini_client: gemini).call

    expect(comparison_for(report, 'Communication')).to include('result' => 'match',  'delta' => 0)
    expect(comparison_for(report, 'SQL')).to           include('result' => 'gap',    'delta' => -2)
    expect(comparison_for(report, 'Testing')).to       include('result' => 'exceed', 'delta' => 3)
  end

  it 'uses the assessor override instead of the AI level' do
    create(:vacancy_skill, vacancy: vacancy, skill_label: 'SQL', expected_level: 4)
    skill = create(:portfolio_skill, portfolio: portfolio, skill_label: 'SQL', ai_level: 2)
    create(:assessor_override, portfolio_skill: skill, override_level: 4)

    report = described_class.new(portfolio: portfolio, vacancy: vacancy, gemini_client: gemini).call

    expect(comparison_for(report, 'SQL')).to include('candidate_level' => 4, 'result' => 'match')
  end

  it 'stores the model narrative when Gemini answers' do
    create(:vacancy_skill, vacancy: vacancy)
    create(:portfolio_skill, portfolio: portfolio)

    report = described_class.new(portfolio: portfolio, vacancy: vacancy, gemini_client: gemini).call

    expect(report.culture_narrative).to eq('Culture text')
    expect(report.overall_narrative).to eq('Overall text')
  end

  it 'regenerating updates the same report row instead of adding one' do
    create(:vacancy_skill, vacancy: vacancy)
    create(:portfolio_skill, portfolio: portfolio)
    engine = described_class.new(portfolio: portfolio, vacancy: vacancy, gemini_client: gemini)

    expect { 2.times { engine.call } }.to change(FitGapReport, :count).by(1)
  end

  # Revamp contract — see assessment/02-strategy.md (AC2–AC9).
  describe 'honest report contract' do
    def build_report(gemini_client: gemini)
      described_class.new(portfolio: portfolio, vacancy: vacancy, gemini_client: gemini_client).call
    end

    context 'with an override, a low-confidence skill and an unassessed skill' do
      before do
        create(:vacancy_skill, vacancy: vacancy, skill_label: 'SQL',           expected_level: 4)
        create(:vacancy_skill, vacancy: vacancy, skill_label: 'Communication', expected_level: 3)
        create(:vacancy_skill, vacancy: vacancy, skill_label: 'Kubernetes',    expected_level: 2)
        sql = create(:portfolio_skill, portfolio: portfolio, skill_label: 'SQL', ai_level: 2, ai_confidence: 'low')
        create(:assessor_override, portfolio_skill: sql, override_level: 4)
        create(:portfolio_skill, portfolio: portfolio, skill_label: 'Communication', ai_level: 2, ai_confidence: 'low')
      end

      it 'flags overridden skills and keeps the AI level for audit (AC2, AC3)' do
        report = build_report

        expect(comparison_for(report, 'SQL')).to include('is_override' => true, 'ai_level' => 2, 'candidate_level' => 4)
        expect(comparison_for(report, 'Communication')).to include('is_override' => false)
      end

      it 'marks low AI confidence only on skills a human did not override (AC5)' do
        report = build_report

        expect(comparison_for(report, 'Communication')).to include('low_confidence' => true)
        expect(comparison_for(report, 'SQL')).to include('low_confidence' => false)
      end

      it 'keeps an unassessed skill out of match/gap/exceed (AC4)' do
        expect(comparison_for(build_report, 'Kubernetes'))
          .to include('result' => 'not_assessed', 'candidate_level' => nil, 'delta' => nil, 'is_override' => false)
      end

      it 'summarises coverage, outcomes and weak evidence (AC6)' do
        expect(build_report.summary).to eq(
          'total' => 3, 'assessed' => 2, 'not_assessed' => 1, 'coverage_pct' => 67,
          'match' => 1, 'gap' => 1, 'exceed' => 0, 'low_confidence' => 1
        )
      end

      it 'marks the report ready with no error (AC9)' do
        report = build_report

        expect(report).to have_attributes(status: 'ready', error_message: nil)
        expect(report.generated_at).to be_present
      end

      it 'labels a model narrative as coming from the AI (AC7)' do
        expect(build_report.narrative_source).to eq('ai')
      end

      [
        ['the model call raises',            -> { FakeGeminiClient.new(error: Gemini::HttpClient::TimeoutError.new('timeout')) }],
        ['the model returns non-JSON text',  -> { FakeGeminiClient.new(response: 'Sorry, I cannot help') }],
        ['the model returns a JSON array',   -> { FakeGeminiClient.new(response: '[]') }],
        ['the model omits overall_narrative', -> { FakeGeminiClient.new(response: { 'culture_narrative' => 'x' }) }]
      ].each do |scenario, client|
        it "falls back honestly when #{scenario} (AC8)" do
          report = build_report(gemini_client: client.call)

          expect(report).to have_attributes(status: 'ready', narrative_source: 'fallback', culture_narrative: nil)
          expect(report.overall_narrative).to include('1 not assessed')
        end
      end
    end

    it 'handles a vacancy with no required skills without dividing by zero (AC6)' do
      expect(build_report.summary).to include('total' => 0, 'assessed' => 0, 'coverage_pct' => 0)
    end
  end
end
