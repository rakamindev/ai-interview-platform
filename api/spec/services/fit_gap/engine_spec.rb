# frozen_string_literal: true

require 'rails_helper'

RSpec.describe FitGap::Engine do
  subject(:report) { described_class.new(portfolio: portfolio, vacancy: vacancy, gemini_client: client).call }

  let(:tenant_id)  { create_organization(scheme: 'fitgap-corp') }
  let(:assessment) { create(:assessment) }
  let(:session)    { create(:session, assessment: assessment) }
  let(:portfolio)  { create(:portfolio, session: session) }
  let(:vacancy)    { create(:vacancy) }

  # Default: the model call fails, because that is the path an assessor is
  # most likely to be reading during an incident and the one that was silently
  # dropping information.
  let(:client) { instance_double(Gemini::HttpClient) }

  before do
    Current.tenant_id = tenant_id
    allow(client).to receive(:generate_content).and_raise(Faraday::TimeoutError)
  end

  def comparison_for(label) = report.skill_comparisons.find { |c| c['skill_label'] == label }

  describe 'not assessed' do
    it 'reports a skill with no portfolio entry as not_covered' do
      create(:vacancy_skill, vacancy: vacancy, skill_label: 'Security', expected_level: 3)

      expect(comparison_for('Security')).to include(
        'result' => 'not_assessed',
        'candidate_level' => nil,
        'delta' => nil,
        'not_assessed_reason' => 'not_covered'
      )
    end

    # The distinction the schema could not previously express: this skill was
    # discussed, and the evidence did not support placing it.
    it 'reports an unrated portfolio skill as insufficient_evidence' do
      create(:vacancy_skill, vacancy: vacancy, skill_label: 'REST', expected_level: 3)
      create(:portfolio_skill, :unassessed, portfolio: portfolio, skill_label: 'REST')

      expect(comparison_for('REST')).to include(
        'result' => 'not_assessed',
        'not_assessed_reason' => 'insufficient_evidence'
      )
    end

    it 'never reports an unrated skill as a gap' do
      create(:vacancy_skill, vacancy: vacancy, skill_label: 'REST', expected_level: 5)
      create(:portfolio_skill, :unassessed, portfolio: portfolio, skill_label: 'REST')

      expect(comparison_for('REST')['result']).not_to eq('gap')
    end
  end

  describe 'comparison arithmetic' do
    before do
      create(:vacancy_skill, vacancy: vacancy, skill_label: 'Equal',  expected_level: 3)
      create(:vacancy_skill, vacancy: vacancy, skill_label: 'Above',  expected_level: 2)
      create(:vacancy_skill, vacancy: vacancy, skill_label: 'Below',  expected_level: 5)
      create(:portfolio_skill, portfolio: portfolio, skill_label: 'Equal', ai_level: 3)
      create(:portfolio_skill, portfolio: portfolio, skill_label: 'Above', ai_level: 4)
      create(:portfolio_skill, portfolio: portfolio, skill_label: 'Below', ai_level: 2)
    end

    it { expect(comparison_for('Equal')).to include('result' => 'match',  'delta' => 0) }
    it { expect(comparison_for('Above')).to include('result' => 'exceed', 'delta' => 2) }
    it { expect(comparison_for('Below')).to include('result' => 'gap',    'delta' => -3) }
  end

  describe 'assessor override provenance' do
    let!(:skill) { create(:portfolio_skill, portfolio: portfolio, skill_label: 'Testing', ai_level: 3) }

    before do
      create(:vacancy_skill, vacancy: vacancy, skill_label: 'Testing', expected_level: 3)
      create(:assessor_override, portfolio_skill: skill, ai_level: 3, override_level: 2)
    end

    it 'compares against the assessor level, not the model level' do
      expect(comparison_for('Testing')).to include('candidate_level' => 2, 'result' => 'gap')
    end

    # `overridden` was computed and then left out of the emitted hash, so the
    # UI could not tell a human judgement from a model one — while printing a
    # legend that claimed it could.
    it 'flags the row as overridden' do
      expect(comparison_for('Testing')['is_override']).to be(true)
    end

    it 'carries the model level that was overruled' do
      expect(comparison_for('Testing')['ai_level']).to eq(3)
    end

    it 'marks unoverridden rows as not overridden' do
      create(:vacancy_skill, vacancy: vacancy, skill_label: 'Plain', expected_level: 3)
      create(:portfolio_skill, portfolio: portfolio, skill_label: 'Plain', ai_level: 3)

      expect(comparison_for('Plain')['is_override']).to be(false)
    end
  end

  describe 'skill matching' do
    it 'matches on taxonomy id regardless of label drift' do
      create(:vacancy_skill, vacancy: vacancy, skill_id: 'SK-ENG-001', skill_label: 'React (frontend)', expected_level: 3)
      create(:portfolio_skill, portfolio: portfolio, skill_id: 'SK-ENG-001', skill_label: 'React', ai_level: 4)

      expect(comparison_for('React (frontend)')['result']).to eq('exceed')
    end

    it 'matches on label ignoring case and surrounding whitespace' do
      create(:vacancy_skill, vacancy: vacancy, skill_label: '  Kubernetes ', expected_level: 3)
      create(:portfolio_skill, portfolio: portfolio, skill_label: 'kubernetes', ai_level: 3)

      expect(comparison_for('  Kubernetes ')['result']).to eq('match')
    end

    # index_by(&:skill_label) kept only the last of a duplicated label, which
    # dropped a stated requirement out of the report entirely.
    it 'keeps every vacancy skill when two share a label' do
      create(:vacancy_skill, vacancy: vacancy, skill_label: 'Comms', expected_level: 2)
      create(:vacancy_skill, vacancy: vacancy, skill_label: 'Comms', expected_level: 4)

      expect(report.skill_comparisons.count { |c| c['skill_label'] == 'Comms' }).to eq(2)
      expect(report.skill_comparisons.map { |c| c['expected_level'] }).to contain_exactly(2, 4)
    end
  end

  describe 'the fallback narrative' do
    before do
      create(:vacancy_skill, vacancy: vacancy, skill_label: 'Known',   expected_level: 3)
      create(:vacancy_skill, vacancy: vacancy, skill_label: 'Missing', expected_level: 3)
      create(:portfolio_skill, portfolio: portfolio, skill_label: 'Known', ai_level: 3)
    end

    it 'is marked as a fallback so the client can say so' do
      expect(report.narrative_status).to eq('fallback')
    end

    it 'leaves culture_narrative empty rather than inventing one' do
      expect(report.culture_narrative).to be_nil
    end

    # The defect: "1 match, 0 exceeds, 0 gaps" against a two-skill role reads
    # as a complete evaluation. The unassessed skill was in no count at all.
    it 'accounts for every required skill' do
      expect(report.overall_narrative).to include('2 required skills')
    end

    it 'names the skills that were not assessed' do
      expect(report.overall_narrative).to include('Missing')
      expect(report.overall_narrative).to match(/not assessed/i)
    end

    it 'says the narrative is mechanical' do
      expect(report.overall_narrative).to match(/mechanical summary/i)
    end
  end

  describe 'a successful narrative' do
    before do
      # Overrides the suite-wide timeout stub — nested before hooks run last.
      allow(client).to receive(:generate_content).and_return(
        'culture_narrative' => 'Fits the team.', 'overall_narrative' => 'Recommend.'
      )
      create(:vacancy_skill, vacancy: vacancy, skill_label: 'Known', expected_level: 3)
    end

    it { expect(report.narrative_status).to eq('complete') }
    it { expect(report.culture_narrative).to eq('Fits the team.') }
  end

  describe 'a vacancy with no skills' do
    # skill_comparisons was `validates presence: true`, and [] is blank in
    # Rails — so this raised RecordInvalid inside the worker, which then
    # retried and never terminated.
    it 'produces an empty report instead of raising' do
      expect { report }.not_to raise_error
      expect(report.skill_comparisons).to eq([])
    end

    it 'says there is nothing to compare' do
      expect(report.overall_narrative).to match(/nothing to compare/i)
    end
  end

  describe 'PII in logs' do
    before do
      create(:vacancy_skill, vacancy: vacancy, skill_label: 'Known', expected_level: 3)
      allow(client).to receive(:generate_content).and_raise(
        JSON::ParserError, "unexpected token at 'the candidate said something private'"
      )
    end

    it 'logs the failure class without the response body' do
      logged = []
      allow(Rails.logger).to receive(:error) { |msg| logged << msg.to_s }

      report

      expect(logged.join("\n")).to include('JSON::ParserError')
      expect(logged.join("\n")).not_to include('something private')
    end
  end

  describe 'regeneration' do
    before { create(:vacancy_skill, vacancy: vacancy, skill_label: 'Known', expected_level: 3) }

    it 'updates the existing report rather than creating a duplicate' do
      first = report
      second = described_class.new(portfolio: portfolio, vacancy: vacancy, gemini_client: client).call

      expect(second.id).to eq(first.id)
      expect(FitGapReport.where(portfolio_id: portfolio.id, vacancy_id: vacancy.id).count).to eq(1)
    end
  end
end
