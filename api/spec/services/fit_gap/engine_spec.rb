# frozen_string_literal: true

require 'rails_helper'

RSpec.describe FitGap::Engine do
  let(:org) { create_organization(scheme: 'acme') }

  around { |example| as_tenant(org) { example.run } }

  let(:portfolio) { create(:portfolio) }
  let(:vacancy) { create(:vacancy) }
  let(:narrative) { { 'culture_narrative' => 'Fits an ownership culture.', 'overall_narrative' => 'Recommend.' } }

  def run(client = FakeGeminiClient.new(narrative))
    described_class.new(portfolio:, vacancy:, gemini_client: client).call
  end

  def comparison(report, label)
    report.skill_comparisons.find { |c| c['skill_label'] == label }
  end

  it 'compares rated skills against the requirement' do
    create(:portfolio_skill, portfolio:, skill_label: 'React', ai_level: 3)
    create(:portfolio_skill, portfolio:, skill_label: 'Testing', ai_level: 2)
    create(:portfolio_skill, portfolio:, skill_label: 'Design', ai_level: 4)
    create(:vacancy_skill, vacancy:, skill_label: 'React', expected_level: 3)
    create(:vacancy_skill, vacancy:, skill_label: 'Testing', expected_level: 3)
    create(:vacancy_skill, vacancy:, skill_label: 'Design', expected_level: 2)

    report = run

    expect(comparison(report, 'React')).to include('result' => 'match', 'delta' => 0, 'expected_level' => 3)
    expect(comparison(report, 'Testing')).to include('result' => 'gap', 'delta' => -1)
    expect(comparison(report, 'Design')).to include('result' => 'exceed', 'delta' => 2)
  end

  describe 'skills without a level (F1)' do
    before do
      create(:portfolio_skill, :not_assessed, portfolio:, skill_label: 'System Design')
      create(:vacancy_skill, vacancy:, skill_label: 'System Design', expected_level: 3)
      create(:vacancy_skill, vacancy:, skill_label: 'Kubernetes', expected_level: 2)
    end

    it 'reports them as not assessed rather than as a gap' do
      report = run

      expect(comparison(report, 'System Design')).to include(
        'result' => 'not_assessed', 'candidate_level' => nil, 'delta' => nil, 'rating_status' => 'not_assessed'
      )
      expect(comparison(report, 'Kubernetes')).to include('result' => 'not_assessed', 'rating_status' => 'missing')
    end

    it 'tells the narrative model they are not weaknesses' do
      client = FakeGeminiClient.new(narrative)
      run(client)

      expect(client.prompts.first).to include('Gaps (0)')
      expect(client.prompts.first).to include('Not assessed (2): System Design, Kubernetes')
      expect(client.prompts.first).to include('It is NOT a weakness')
    end
  end

  it 'uses the assessor override and still reports the AI level (F2)' do
    skill = create(:portfolio_skill, portfolio:, skill_label: 'React', ai_level: 2, ai_confidence: 'low')
    create(:assessor_override, portfolio_skill: skill, override_level: 3)
    create(:vacancy_skill, vacancy:, skill_label: 'React', expected_level: 3)

    expect(comparison(run, 'React')).to include(
      'result' => 'match', 'candidate_level' => 3, 'ai_level' => 2, 'overridden' => true, 'low_confidence' => false
    )
  end

  it 'flags low-confidence ratings for verification (F3)' do
    create(:portfolio_skill, portfolio:, skill_label: 'React', ai_level: 2, ai_confidence: 'low')
    create(:vacancy_skill, vacancy:, skill_label: 'React', expected_level: 3)

    expect(comparison(run, 'React')).to include('result' => 'gap', 'low_confidence' => true)
  end

  it 'matches by skill_id first, then by label ignoring case and punctuation (F4)' do
    create(:portfolio_skill, portfolio:, skill_id: 'sk-1', skill_label: 'Frontend (React)', ai_level: 4)
    create(:portfolio_skill, portfolio:, skill_label: 'communication', ai_level: 2)
    create(:vacancy_skill, vacancy:, skill_id: 'sk-1', skill_label: 'React', expected_level: 3)
    create(:vacancy_skill, vacancy:, skill_label: '  Communication ', expected_level: 2)

    report = run

    expect(comparison(report, 'React')).to include('candidate_level' => 4)
    expect(comparison(report, '  Communication ')).to include('candidate_level' => 2)
  end

  describe 'narrative failures (F5)' do
    before do
      create(:portfolio_skill, portfolio:, skill_label: 'React', ai_level: 3)
      create(:vacancy_skill, vacancy:, skill_label: 'React', expected_level: 3)
      create(:vacancy_skill, vacancy:, skill_label: 'Go', expected_level: 3)
    end

    it 'still saves the report with an automatic summary when the model errors' do
      report = run(FakeGeminiClient.new(Gemini::HttpClient::TimeoutError.new('timeout')))

      expect(report).to be_persisted
      expect(report.culture_narrative).to be_nil
      expect(report.overall_narrative).to start_with('Automatic summary')
      expect(report.overall_narrative).to include('1 required skills were not assessed')
    end

    it 'falls back when the model answers with the wrong shape' do
      report = run(FakeGeminiClient.new({ 'culture_narrative' => ['not', 'a string'] }))

      expect(report.overall_narrative).to start_with('Automatic summary')
    end
  end

  describe '.fingerprint (F6)' do
    let!(:skill) { create(:portfolio_skill, portfolio:, skill_label: 'React', ai_level: 3) }

    before { create(:vacancy_skill, vacancy:, skill_label: 'React', expected_level: 3) }

    it 'changes when an override is saved' do
      before = described_class.fingerprint(portfolio, vacancy)
      create(:assessor_override, portfolio_skill: skill, override_level: 4)

      expect(described_class.fingerprint(portfolio.reload, vacancy)).not_to eq(before)
    end

    it 'changes when the vacancy requirement changes' do
      before = described_class.fingerprint(portfolio, vacancy)
      vacancy.vacancy_skills.first.update!(expected_level: 4)

      expect(described_class.fingerprint(portfolio, vacancy.reload)).not_to eq(before)
    end

    it 'is stored on the report' do
      expect(run.input_fingerprint).to eq(described_class.fingerprint(portfolio, vacancy))
    end
  end

  it 'updates the existing row when another job inserted it first (F7)' do
    create(:vacancy_skill, vacancy:, skill_label: 'React', expected_level: 3)
    other = FitGapReport.create!(portfolio:, vacancy:, skill_comparisons: [{ 'old' => true }])
    allow(FitGapReport).to receive(:find_or_initialize_by).and_wrap_original do |original, *args, **kwargs|
      record = original.call(*args, **kwargs)
      record.persisted? ? FitGapReport.new(portfolio:, vacancy:) : record
    end

    report = run

    expect(report.id).to eq(other.id)
    expect(FitGapReport.where(portfolio:, vacancy:).count).to eq(1)
  end
end
