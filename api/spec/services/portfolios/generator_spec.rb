# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Portfolios::Generator do
  let(:assessment) { create(:assessment, :with_skills) }
  let(:session)    { create(:session, :ended, assessment:) }

  let(:react_entry) do
    {
      'skill_id' => 'SK-ENG-001', 'skill_label' => 'React', 'level' => 3, 'confidence' => 'medium',
      'evidence' => ['moved hot data into useRef'], 'competency_summary' => 'Profiling-driven optimisation.'
    }
  end

  before do
    create(:transcript_turn, session:, turn_number: 1, speaker: 'ai', text: 'How did you find the slow renders?')
    create(:transcript_turn, session:, turn_number: 2, speaker: 'candidate',
                             text: 'We profiled with React DevTools and moved hot data into useRef.')
    create(:coverage_map, session:, skill_id: 'SK-ENG-001', skill_label: 'React', state: 'partial', probe_count: 2)
    create(:coverage_map, session:, skill_id: 'SK-SOFT-001', skill_label: 'Communication')
    create(:coverage_map, session:, skill_id: 'SK-ENG-003', skill_label: 'System Design')
  end

  def generate(response)
    described_class.new(session:, gemini_client: FakeGemini.new(response)).call
  end

  describe 'a successful generation' do
    it 'stores each rated skill and marks the portfolio complete' do
      portfolio = generate('configured_skills' => [react_entry], 'discovered_skills' => [])

      expect(portfolio).to have_attributes(generation_status: 'complete', generated_at: be_present)
      expect(portfolio.portfolio_skills.find_by!(skill_label: 'React')).to have_attributes(
        skill_id: 'SK-ENG-001', ai_level: 3, ai_confidence: 'medium', is_discovered: false
      )
    end

    it 'stores discovered skills separately' do
      discovered = react_entry.merge('skill_id' => nil, 'skill_label' => 'Micro-frontends', 'level' => 2, 'confidence' => 'low')

      portfolio = generate('configured_skills' => [], 'discovered_skills' => [discovered])

      expect(portfolio.portfolio_skills.where(is_discovered: true).sole)
        .to have_attributes(skill_label: 'Micro-frontends', is_discovered: true)
    end

    it 'keeps at most three evidence quotes' do
      quotes = ['We profiled', 'with React DevTools', 'and moved hot data', 'into useRef', 'React DevTools']
      entry  = react_entry.merge('evidence' => quotes)

      expect(generate('configured_skills' => [entry]).portfolio_skills.find_by!(skill_label: 'React').evidence)
        .to eq(quotes.first(3))
    end

    it 'replaces the previous skills when run again' do
      generate('configured_skills' => [react_entry])
      portfolio = generate('configured_skills' => [react_entry.merge('level' => 4)])

      expect(portfolio.portfolio_skills.where(skill_label: 'React').pluck(:ai_level)).to eq([4])
    end

    it 'sends the transcript and the skill anchors to the model' do
      client = FakeGemini.new('configured_skills' => [react_entry])
      described_class.new(session:, gemini_client: client).call

      prompt = client.prompts.sole[:prompt]
      expect(prompt).to include('[CANDIDATE]: We profiled with React DevTools', 'L3 — Handles ambiguity and trade-offs.')
    end
  end

  describe 'when the model call fails' do
    it 'marks the portfolio failed with a safe message and a category, and re-raises for Sidekiq' do
      expect { generate(Gemini::HttpClient::TimeoutError.new('Gemini API timeout after 180s')) }
        .to raise_error(Gemini::HttpClient::TimeoutError)

      expect(session.reload.portfolio).to have_attributes(
        generation_status: 'failed', generation_error_category: 'model_timeout',
        generation_error: "Model timeout: the AI didn't answer in time."
      )
    end
  end

  # ── Step 4, Option B: "not assessed" is a real state (AC-1..AC-12) ──────────
  # Coverage in this file: React partial (2 probes); Communication and System Design not_yet.

  describe 'deciding what was assessed' do
    def row(portfolio, label) = portfolio.portfolio_skills.find_by!(skill_label: label)

    it 'AC-1: stores a skill the model could not rate with no level, never L1' do
      portfolio = generate('configured_skills' => [react_entry.merge('level' => nil)])

      expect(row(portfolio, 'React')).to have_attributes(ai_level: nil, not_assessed_reason: 'insufficient_evidence')
    end

    it 'AC-2: discards a level for a skill the interview never probed' do
      invented = react_entry.merge('skill_id' => 'SK-SOFT-001', 'skill_label' => 'Communication', 'level' => 4,
                                   'evidence' => ['We profiled with React DevTools'])
      portfolio = generate('configured_skills' => [react_entry, invented])

      expect(row(portfolio, 'Communication')).to have_attributes(ai_level: nil, not_assessed_reason: 'not_reached')
    end

    it 'AC-2: treats a configured skill with no coverage row as not reached' do
      session.coverage_maps.find_by!(skill_label: 'React').destroy

      expect(row(generate('configured_skills' => [react_entry]), 'React'))
        .to have_attributes(ai_level: nil, not_assessed_reason: 'not_reached')
    end

    [3, '3', 3.0].each do |level|
      it "AC-3: reads #{level.inspect} as level 3" do
        expect(row(generate('configured_skills' => [react_entry.merge('level' => level)]), 'React').ai_level).to eq(3)
      end
    end

    %w[L3 l3].each do |level|
      it "AC-3: reads #{level.inspect} as level 3" do
        expect(row(generate('configured_skills' => [react_entry.merge('level' => level)]), 'React').ai_level).to eq(3)
      end
    end

    [0, 6, -1, 2.5, 'N/A', 'high', 'L3.5', '', true, [], {}].each do |level|
      it "AC-4: stores #{level.inspect} as not assessed instead of clamping it" do
        expect(row(generate('configured_skills' => [react_entry.merge('level' => level)]), 'React'))
          .to have_attributes(ai_level: nil, not_assessed_reason: 'insufficient_evidence')
      end
    end

    it 'AC-5: gives a skill the model left out a row, marked omitted' do
      session.coverage_maps.find_by!(skill_label: 'System Design').update!(state: 'covered', probe_count: 3)
      portfolio = generate('configured_skills' => [react_entry])

      expect(row(portfolio, 'System Design')).to have_attributes(ai_level: nil, not_assessed_reason: 'omitted_by_model')
      expect(portfolio.portfolio_skills.where(is_discovered: false).pluck(:skill_label))
        .to contain_exactly('React', 'Communication', 'System Design')
    end

    it 'AC-6: keeps the first of two entries for the same skill' do
      portfolio = generate('configured_skills' => [react_entry, react_entry.merge('level' => 5)])

      expect(portfolio.portfolio_skills.where(skill_label: 'React').pluck(:ai_level)).to eq([3])
    end

    it 'AC-6: stores a "configured" skill that is not configured as discovered' do
      stray = react_entry.merge('skill_id' => 'SK-X-999', 'skill_label' => 'GraphQL', 'level' => 2)
      portfolio = generate('configured_skills' => [react_entry, stray])

      expect(row(portfolio, 'GraphQL')).to have_attributes(is_discovered: true, skill_id: nil, ai_level: 2)
    end

    it 'AC-6: keeps the configured label, whatever the model calls the skill' do
      renamed = react_entry.merge('skill_label' => 'React.js / Frontend')

      expect(generate('configured_skills' => [renamed]).portfolio_skills.where(skill_id: 'SK-ENG-001').sole.skill_label)
        .to eq('React')
    end

    it 'stores a discovered skill with no readable level as not assessed' do
      discovered = react_entry.merge('skill_id' => nil, 'skill_label' => 'Micro-frontends', 'level' => 'unknown')
      portfolio = generate('configured_skills' => [react_entry], 'discovered_skills' => [discovered])

      expect(row(portfolio, 'Micro-frontends')).to have_attributes(ai_level: nil, not_assessed_reason: 'insufficient_evidence')
    end

    it 'AC-12: leaves confidence, summary and evidence empty for a skill that was not assessed' do
      portfolio = generate('configured_skills' => [react_entry.merge('level' => nil)])

      expect(row(portfolio, 'React')).to have_attributes(ai_confidence: nil, competency_summary: nil, evidence: [])
    end

    it 'reads confidence case-insensitively, and treats an unknown value as low' do
      portfolio = generate('configured_skills' => [react_entry.merge('confidence' => ' High ')])
      expect(row(portfolio, 'React').ai_confidence).to eq('high')

      portfolio = generate('configured_skills' => [react_entry.merge('confidence' => 'very sure')])
      expect(row(portfolio, 'React').ai_confidence).to eq('low')
    end

    it 'tells the model to answer null instead of guessing a level' do
      client = FakeGemini.new('configured_skills' => [react_entry])
      described_class.new(session:, gemini_client: client).call

      expect(client.prompts.sole[:prompt]).to include('"level": null')
    end
  end

  describe 'evidence (AC-7, AC-11)' do
    def react(portfolio) = portfolio.portfolio_skills.find_by!(skill_label: 'React')

    it "keeps a quote despite differences in case, spacing and quote marks" do
      create(:transcript_turn, session:, turn_number: 3, speaker: 'candidate', text: "It's the  team's call.")
      entry = react_entry.merge('evidence' => ['moved hot data into useRef', "IT’S THE TEAM’S CALL"])

      expect(react(generate('configured_skills' => [entry])).evidence)
        .to eq(['moved hot data into useRef', "IT’S THE TEAM’S CALL"])
    end

    it "drops a quote that only appears in the interviewer's turns" do
      entry = react_entry.merge('evidence' => ['How did you find the slow renders?', 'moved hot data into useRef'])

      expect(react(generate('configured_skills' => [entry])).evidence).to eq(['moved hot data into useRef'])
    end

    it 'keeps the level but lowers confidence to low when no quote can be verified' do
      entry = react_entry.merge('confidence' => 'high', 'evidence' => ['I rewrote the whole app in a weekend'])

      expect(react(generate('configured_skills' => [entry])))
        .to have_attributes(ai_level: 3, ai_confidence: 'low', evidence: [])
    end

    it 'caps a very long quote at 500 characters and a summary at 2,000' do
      long_answer = "We profiled #{'and measured again ' * 1200}"
      create(:transcript_turn, session:, turn_number: 3, speaker: 'candidate', text: long_answer)
      entry = react_entry.merge('evidence' => [long_answer.strip], 'competency_summary' => 'x' * 20_000)

      skill = react(generate('configured_skills' => [entry]))
      expect(skill.evidence.sole.length).to eq(500)
      expect(skill.evidence.sole).to end_with('…')
      expect(skill.competency_summary.length).to eq(2000)
    end
  end

  describe 'regenerating (AC-8, AC-9)' do
    it 'keeps the override on the skill with the same identity, with the new AI level underneath' do
      portfolio = generate('configured_skills' => [react_entry])
      create(:assessor_override, portfolio_skill: portfolio.portfolio_skills.find_by!(skill_label: 'React'),
                                 override_level: 4, assessor_notes: 'Probed further in round two')

      portfolio = generate('configured_skills' => [react_entry.merge('level' => 2)])

      react = portfolio.portfolio_skills.find_by!(skill_label: 'React')
      expect(react.ai_level).to eq(2)
      expect(react.assessor_override).to have_attributes(override_level: 4, assessor_notes: 'Probed further in round two')
    end

    it 'keeps a discovered skill the assessor rated, even if the model drops it next time' do
      discovered = react_entry.merge('skill_id' => nil, 'skill_label' => 'Micro-frontends', 'level' => 2)
      portfolio  = generate('configured_skills' => [react_entry], 'discovered_skills' => [discovered])
      create(:assessor_override, portfolio_skill: portfolio.portfolio_skills.find_by!(skill_label: 'Micro-frontends'))

      portfolio = generate('configured_skills' => [react_entry], 'discovered_skills' => [])

      expect(portfolio.portfolio_skills.find_by(skill_label: 'Micro-frontends')&.assessor_override).to be_present
    end

    it 'removes a discovered skill nobody rated when the model drops it' do
      discovered = react_entry.merge('skill_id' => nil, 'skill_label' => 'Micro-frontends', 'level' => 2)
      generate('configured_skills' => [react_entry], 'discovered_skills' => [discovered])

      portfolio = generate('configured_skills' => [react_entry], 'discovered_skills' => [])

      expect(portfolio.portfolio_skills.where(skill_label: 'Micro-frontends')).to be_empty
    end
  end

  describe 'model failures (AC-10)' do
    # Starts with the personal data: a JSON parser error quotes only the first token of the reply.
    let(:raw) { 'Budi Santoso, who said his salary is 25 juta, is a strong candidate.' }

    before { generate('configured_skills' => [react_entry]) }

    it 'categorises a reply that is not JSON, without storing or logging the raw text' do
      logged = []
      allow(Rails.logger).to receive(:error) { |message| logged << message }

      expect { generate(raw) }.to raise_error(described_class::InvalidResponse)

      portfolio = session.reload.portfolio
      expect(portfolio).to have_attributes(generation_status: 'failed', generation_error_category: 'model_invalid_response')
      expect(portfolio.generation_error).not_to include('Budi')
      expect(logged.join("\n")).not_to include('Budi')
      expect(portfolio.portfolio_skills.find_by!(skill_label: 'React').ai_level).to eq(3)
    end

    it 'categorises JSON without configured_skills as an invalid response, and keeps the previous skills' do
      expect { generate('skills' => []) }.to raise_error(Portfolios::Generator::InvalidResponse)

      portfolio = session.reload.portfolio
      expect(portfolio).to have_attributes(generation_status: 'failed', generation_error_category: 'model_invalid_response')
      expect(portfolio.portfolio_skills.find_by!(skill_label: 'React').ai_level).to eq(3)
    end

    it 'categorises a rate limit or outage as the model being unavailable' do
      expect { generate(Gemini::HttpClient::RateLimitError.new('429')) }.to raise_error(Gemini::HttpClient::RateLimitError)

      expect(session.reload.portfolio.generation_error_category).to eq('model_unavailable')
    end

    it 'clears the category when a later run succeeds' do
      expect { generate(Gemini::HttpClient::TimeoutError.new('timeout')) }.to raise_error(Gemini::HttpClient::TimeoutError)
      portfolio = generate('configured_skills' => [react_entry])

      expect(portfolio).to have_attributes(generation_status: 'complete', generation_error: nil,
                                           generation_error_category: nil)
    end
  end

  # ── Known defects from assessment/03-problem-and-gap.md ─────────────────────
  # `pending` runs each example and expects it to FAIL today. When the defect is
  # fixed, RSpec reports "Expected pending ... to fail" and the marker must be removed.

  describe 'known defects (Step 3)' do
    let(:unassessed_output) do
      {
        'configured_skills' => [
          react_entry,
          { 'skill_id' => 'SK-SOFT-001', 'skill_label' => 'Communication', 'level' => nil, 'confidence' => 'low',
            'evidence' => [], 'competency_summary' => 'Not assessed.' }
        ]
      }
    end

    it 'P0-1: does not turn a skill the model could not rate into an L1 rating' do
      portfolio = generate(unassessed_output)

      expect(portfolio.portfolio_skills.find_by(skill_label: 'Communication')&.ai_level).to be_nil
    end

    it 'P1-3: accounts for every configured skill, even if the model leaves one out' do
      portfolio = generate('configured_skills' => [react_entry])

      expect(portfolio.portfolio_skills.pluck(:skill_label))
        .to match_array(['React', 'Communication', 'System Design'])
    end

    it 'P1-4: leaves no half-written portfolio when a write fails partway (AC-8)' do
      generate('configured_skills' => [react_entry])

      # The second skill row of the next run fails to save.
      saves = 0
      allow_any_instance_of(PortfolioSkill).to receive(:save!).and_wrap_original do |original, *args, **opts|
        saves += 1
        raise ActiveRecord::RecordInvalid if saves == 2

        original.call(*args, **opts)
      end

      communication = react_entry.merge('skill_id' => 'SK-SOFT-001', 'skill_label' => 'Communication', 'level' => 2)
      expect { generate('configured_skills' => [react_entry.merge('level' => 4), communication]) }
        .to raise_error(ActiveRecord::RecordInvalid)

      portfolio = session.reload.portfolio
      expect(portfolio.generation_status).to eq('failed')
      expect(portfolio.portfolio_skills.find_by!(skill_label: 'React').ai_level).to eq(3)
    end

    it "P1-4: keeps the assessor's overrides when the portfolio is regenerated" do
      portfolio = generate('configured_skills' => [react_entry])
      create(:assessor_override, portfolio_skill: portfolio.portfolio_skills.find_by!(skill_label: 'React'),
                                 override_level: 4)

      generate('configured_skills' => [react_entry])

      expect(AssessorOverride.count).to eq(1)
    end

    it 'P1-5: drops evidence quotes that do not appear in the transcript' do
      invented = react_entry.merge('evidence' => ['I led a team of 40 engineers migrating to micro-frontends'])

      expect(generate('configured_skills' => [invented]).portfolio_skills.find_by!(skill_label: 'React').evidence)
        .to be_empty
    end
  end
end
