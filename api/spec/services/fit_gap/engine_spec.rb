# frozen_string_literal: true

require 'rails_helper'

RSpec.describe FitGap::Engine do
  # Records prompts and returns a canned answer, or raises like the real client.
  let(:fake_gemini) do
    Class.new do
      attr_reader :prompts

      def initialize(response: nil, error: nil)
        @response = response
        @error    = error
        @prompts  = []
      end

      def generate_content(prompt, temperature:)
        @prompts << prompt
        raise @error if @error

        @response
      end
    end
  end

  let(:portfolio) { create(:portfolio) }
  let(:vacancy)   { create(:vacancy) }
  let(:narrative) { { 'culture_narrative' => 'Collaborative.', 'overall_narrative' => 'Strong on data.' } }
  let(:gemini)    { fake_gemini.new(response: narrative) }

  def run_engine(client = gemini)
    described_class.new(portfolio: portfolio, vacancy: vacancy, gemini_client: client).call
  end

  before do
    create(:vacancy_skill, vacancy: vacancy, skill_label: 'SQL', expected_level: 3)
    create(:vacancy_skill, vacancy: vacancy, skill_label: 'System Design', expected_level: 4)
    create(:vacancy_skill, vacancy: vacancy, skill_label: 'Kubernetes', expected_level: 3)
    create(:portfolio_skill, portfolio: portfolio, skill_label: 'SQL', ai_level: 3, ai_confidence: 'high')
    create(:portfolio_skill, portfolio: portfolio, skill_label: 'System Design', ai_level: 2, ai_confidence: 'low')
  end

  it 'stores evidence-aware comparisons stamped with the current rules version' do
    report = run_engine

    expect(report.reload.comparator_version).to eq(FitGap::Comparator::VERSION)
    expect(report).to be_current_rules
    expect(report.skill_comparisons.map { |c| [c['skill_label'], c['result']] }).to eq([
      ['System Design', 'insufficient_evidence'],
      ['Kubernetes', 'not_assessed'],
      ['SQL', 'match']
    ])
  end

  it 'updates a report stored under older rules in place' do
    legacy = create(:fit_gap_report, portfolio: portfolio, vacancy: vacancy, comparator_version: nil,
                                     skill_comparisons: [{ 'skill_label' => 'System Design', 'result' => 'gap' }])

    report = run_engine

    expect(report.id).to eq(legacy.id)
    expect(report.reload).to be_current_rules
    expect(report.skill_comparisons.pluck('result')).not_to include('gap')
  end

  describe 'the narrative prompt' do
    it 'lists open questions separately and forbids treating them as weaknesses' do
      run_engine
      prompt = gemini.prompts.sole

      expect(prompt).to include('Needs review (1): System Design')
      expect(prompt).to include('Not assessed (1): Kubernetes')
      expect(prompt).to include('Gaps (0):')
      expect(prompt).to match(/not evidence of weakness/i)
    end
  end

  describe 'when the model call fails' do
    it 'still completes the report with a deterministic summary that names open questions' do
      failing = fake_gemini.new(error: Gemini::HttpClient::TimeoutError.new('timeout'))

      report = run_engine(failing)

      expect(report).to be_persisted
      expect(report.culture_narrative).to be_nil
      expect(report.overall_narrative).to eq(
        '1 of 3 required skills meet or exceed the expected level; 0 fall below it. ' \
        'Still open: 1 needs assessor review and 1 was not covered in the interview. ' \
        'These are open questions, not weaknesses.'
      )
    end

    it 'mentions no open questions when every skill is rated with evidence' do
      vacancy.vacancy_skills.where(skill_label: %w[System\ Design Kubernetes]).destroy_all
      create(:vacancy_skill, vacancy: vacancy, skill_label: 'Go', expected_level: 4)
      create(:portfolio_skill, portfolio: portfolio, skill_label: 'Go', ai_level: 2, ai_confidence: 'medium')

      report = run_engine(fake_gemini.new(error: Gemini::HttpClient::ApiError.new('down')))

      expect(report.overall_narrative).to eq('1 of 2 required skills meet or exceed the expected level; 1 falls below it.')
    end

    it 'falls back the same way when the model returns something that is not the expected JSON' do
      report = run_engine(fake_gemini.new(response: 'Sure! Here is a summary.'))

      expect(report.overall_narrative).to start_with('1 of 3 required skills')
    end
  end

  describe 'a vacancy with no requirements' do
    let(:empty_vacancy) { create(:vacancy) }

    it 'completes with no rows and does not call the model' do
      report = described_class.new(portfolio: portfolio, vacancy: empty_vacancy, gemini_client: gemini).call

      expect(report.reload.skill_comparisons).to eq([])
      expect(report.overall_narrative).to eq('This vacancy has no skill requirements yet, so there is nothing to compare.')
      expect(gemini.prompts).to be_empty
    end
  end
end
