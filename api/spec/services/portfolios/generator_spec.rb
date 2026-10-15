# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Portfolios::Generator do
  let(:org) { create_organization(scheme: 'acme') }

  around { |example| as_tenant(org) { example.run } }

  let(:assessment) { create(:assessment) }
  let!(:react) { create(:assessment_skill, assessment:, skill_id: 'sk-react', skill_label: 'React', display_order: 1) }
  let!(:comms) { create(:assessment_skill, assessment:, skill_id: nil, skill_label: 'Communication', display_order: 2) }
  let!(:design) { create(:assessment_skill, assessment:, skill_id: 'sk-design', skill_label: 'System Design', display_order: 3) }
  let(:session) { create(:session, assessment:) }

  let(:react_quote) { 'we moved real-time data into useRef so it would not trigger renders' }
  let(:comms_quote) { 'I wrote a one-pager with the profiling data before the meeting' }

  before do
    create(:coverage_map, session:, skill_id: 'sk-react', skill_label: 'React', state: 'covered', probe_count: 4)
    create(:coverage_map, session:, skill_id: nil, skill_label: 'Communication', state: 'partial', probe_count: 2)
    create(:coverage_map, session:, skill_id: 'sk-design', skill_label: 'System Design', state: 'not_yet', probe_count: 0)

    create(:transcript_turn, session:, turn_number: 1, speaker: 'ai', text: 'Tell me about a hard frontend problem.')
    create(:transcript_turn, session:, turn_number: 2, speaker: 'candidate',
                             text: 'Honestly, we moved real-time data into useRef so it would not trigger renders. That fixed it.')
    create(:transcript_turn, session:, turn_number: 3, speaker: 'ai', text: 'How did you get the team on board?')
    create(:transcript_turn, session:, turn_number: 4, speaker: 'candidate',
                             text: "I wrote a one-pager with the profiling data before the meeting. People liked it.")
  end

  def model_response(configured: nil, discovered: [])
    {
      'configured_skills' => configured || [
        { 'skill_id' => 'sk-react', 'skill_label' => 'React', 'level' => 3, 'confidence' => 'high',
          'evidence' => [react_quote], 'competency_summary' => 'Strong state management.' },
        { 'skill_id' => nil, 'skill_label' => 'Communication', 'level' => 2, 'confidence' => 'high',
          'evidence' => ["\"#{comms_quote}\""], 'competency_summary' => 'Clear in 1:1.' }
      ],
      'discovered_skills' => discovered
    }
  end

  def generate(client)
    described_class.new(session:, gemini_client: client).call
  end

  def skill(portfolio, label)
    portfolio.portfolio_skills.find_by!(skill_label: label)
  end

  it 'rates skills that were reached and backs each level with verified quotes' do
    portfolio = generate(FakeGeminiClient.new(model_response))

    expect(portfolio).to be_complete
    react_skill = skill(portfolio, 'React')
    expect(react_skill).to have_attributes(rating_status: 'rated', ai_level: 3, probe_count: 4, coverage_state: 'covered')
    expect(react_skill.evidence_quotes).to eq([{ quote: react_quote, turn_number: 2 }])
  end

  describe 'skills the interview never reached (G1)' do
    it 'stores them as not assessed with no level, even if the model rates them' do
      response = model_response
      response['configured_skills'] << { 'skill_id' => 'sk-design', 'skill_label' => 'System Design', 'level' => 1,
                                         'evidence' => [react_quote], 'competency_summary' => 'Guessing.' }

      portfolio = generate(FakeGeminiClient.new(response))

      expect(skill(portfolio, 'System Design')).to have_attributes(
        rating_status: 'not_assessed', ai_level: nil, evidence: [], coverage_state: 'not_yet'
      )
    end

    it 'does not ask the model to rate them' do
      client = FakeGeminiClient.new(model_response)
      generate(client)

      expect(client.prompts.first).not_to include('SKILL: System Design')
      expect(client.prompts.first).to include('SKILL: React')
    end
  end

  it 'keeps a configured skill the model left out, as insufficient evidence (G2)' do
    response = model_response(configured: [model_response['configured_skills'].first])

    portfolio = generate(FakeGeminiClient.new(response))

    expect(skill(portfolio, 'Communication')).to have_attributes(rating_status: 'insufficient_evidence', ai_level: nil)
  end

  describe 'level parsing (G3)' do
    {
      'L3' => 3, '4' => 4, 2.0 => 2
    }.each do |raw, expected|
      it "reads #{raw.inspect} as #{expected}" do
        response = model_response
        response['configured_skills'][0]['level'] = raw
        expect(skill(generate(FakeGeminiClient.new(response)), 'React').ai_level).to eq(expected)
      end
    end

    [nil, 0, 7, 'three', 2.5, -1].each do |raw|
      it "treats #{raw.inspect} as no level instead of clamping it" do
        response = model_response
        response['configured_skills'][0]['level'] = raw

        expect(skill(generate(FakeGeminiClient.new(response)), 'React')).to have_attributes(
          rating_status: 'insufficient_evidence', ai_level: nil
        )
      end
    end
  end

  it 'derives confidence from coverage, not from the model (G4)' do
    portfolio = generate(FakeGeminiClient.new(model_response))

    expect(skill(portfolio, 'React').ai_confidence).to eq('high')          # covered, 4 probes
    expect(skill(portfolio, 'Communication').ai_confidence).to eq('medium') # partial, 2 probes; model said high
  end

  describe 'evidence verification (G5, G6)' do
    it 'drops quotes the candidate never said and quotes from the AI' do
      response = model_response
      response['configured_skills'][0]['evidence'] = [
        react_quote,
        'I have ten years of React experience',          # fabricated
        'Tell me about a hard frontend problem'          # said by the AI
      ]

      quotes = skill(generate(FakeGeminiClient.new(response)), 'React').evidence_quotes.map { |e| e[:quote] }

      expect(quotes).to eq([react_quote])
    end

    it 'accepts quotes stitched with an ellipsis when every fragment is in the same turn' do
      response = model_response
      response['configured_skills'][0]['evidence'] = ['We moved real-time data into useRef … would NOT trigger renders!']

      expect(skill(generate(FakeGeminiClient.new(response)), 'React')).to be_rated
    end

    it 'downgrades a level with no surviving quote to insufficient evidence' do
      response = model_response
      response['configured_skills'][0]['evidence'] = ['I am an expert in everything React']

      expect(skill(generate(FakeGeminiClient.new(response)), 'React')).to have_attributes(
        rating_status: 'insufficient_evidence', ai_level: nil
      )
    end
  end

  it 'caps long summaries and the number of quotes (G7)' do
    response = model_response
    response['configured_skills'][0]['competency_summary'] = 'a' * 5000
    response['configured_skills'][0]['evidence'] = [react_quote, comms_quote, react_quote, comms_quote]

    react_skill = skill(generate(FakeGeminiClient.new(response)), 'React')

    expect(react_skill.competency_summary.length).to eq(described_class::MAX_SUMMARY_LENGTH)
    expect(react_skill.evidence_quotes.size).to eq(2) # duplicates removed
  end

  it 'does not call the model when the candidate never spoke (G8)' do
    session.transcript_turns.where(speaker: 'candidate').delete_all
    client = FakeGeminiClient.new(model_response)

    portfolio = generate(client)

    expect(client.calls).to eq(0)
    expect(portfolio).to be_complete
    expect(portfolio.portfolio_skills.pluck(:rating_status).uniq).to eq(['not_assessed'])
  end

  describe 'model failures (G9, G10)' do
    it 'marks the portfolio failed with a message that holds no transcript text, and re-raises for retry' do
      client = FakeGeminiClient.new(Gemini::HttpClient::TimeoutError.new('Gemini API timeout after 180s'))

      expect { generate(client) }.to raise_error(Gemini::HttpClient::TimeoutError)

      portfolio = session.reload.portfolio
      expect(portfolio).to be_failed
      expect(portfolio.generation_error).to eq('Gemini API timeout after 180s')
    end

    it 'treats a non-JSON answer as a failure instead of saving nothing' do
      client = FakeGeminiClient.new("Sure! Here is the portfolio: #{react_quote}")

      expect { generate(client) }.to raise_error(described_class::InvalidResponseError)
      expect(session.reload.portfolio.generation_error).not_to include(react_quote)
    end

    it 'never stores raw exception text from unexpected errors' do
      client = FakeGeminiClient.new(RuntimeError.new("boom near #{comms_quote}"))

      expect { generate(client) }.to raise_error(RuntimeError)
      expect(session.reload.portfolio.generation_error).to eq('RuntimeError')
    end
  end

  it 'leaves the previous skills untouched when saving fails halfway (G11)' do
    first = generate(FakeGeminiClient.new(model_response))
    before = first.portfolio_skills.order(:id).pluck(:skill_label, :ai_level)
    first.update!(generation_status: 'failed')

    allow_any_instance_of(PortfolioSkill).to receive(:save!).and_wrap_original do |original, *args|
      raise ActiveRecord::RecordInvalid, original.receiver if original.receiver.skill_label == 'Communication'

      original.call(*args)
    end

    expect { generate(FakeGeminiClient.new(model_response)) }.to raise_error(ActiveRecord::RecordInvalid)
    expect(first.reload.portfolio_skills.order(:id).pluck(:skill_label, :ai_level)).to eq(before)
  end

  describe 'duplicate jobs (G12, G13)' do
    it 'skips without calling the model while another job holds the portfolio' do
      create(:portfolio, session:, generation_status: 'generating', generation_started_at: 1.minute.ago)
      client = FakeGeminiClient.new(model_response)

      generate(client)

      expect(client.calls).to eq(0)
    end

    it 'takes over a portfolio stuck in generating for longer than the stale window' do
      create(:portfolio, session:, generation_status: 'generating', generation_started_at: 11.minutes.ago)
      client = FakeGeminiClient.new(model_response)

      expect(generate(client)).to be_complete
      expect(client.calls).to eq(1)
    end

    it 'does not regenerate a complete portfolio' do
      generate(FakeGeminiClient.new(model_response))
      client = FakeGeminiClient.new(model_response)

      generate(client)

      expect(client.calls).to eq(0)
    end
  end

  it 'keeps assessor overrides attached across a regeneration (G14)' do
    portfolio = generate(FakeGeminiClient.new(model_response))
    react_skill = skill(portfolio, 'React')
    override = create(:assessor_override, portfolio_skill: react_skill, override_level: 4)
    portfolio.update!(generation_status: 'failed')

    generate(FakeGeminiClient.new(model_response))

    expect(override.reload.portfolio_skill_id).to eq(react_skill.id)
    expect(skill(portfolio.reload, 'React').effective_level).to eq(4)
  end

  describe 'discovered skills (G15)' do
    before do
      create(:coverage_map, session:, skill_label: 'Technical Writing', is_discovered: true, state: 'partial', probe_count: 2)
    end

    it 'keeps rated ones with confidence from their coverage row' do
      response = model_response(discovered: [
        { 'skill_label' => 'Technical Writing', 'level' => 2, 'evidence' => [comms_quote], 'competency_summary' => 'Writes ahead.' }
      ])

      discovered = skill(generate(FakeGeminiClient.new(response)), 'Technical Writing')

      expect(discovered).to have_attributes(is_discovered: true, ai_level: 2, ai_confidence: 'medium')
    end

    it 'drops discovered skills without verifiable evidence and ones that duplicate a configured skill' do
      response = model_response(discovered: [
        { 'skill_label' => 'Kubernetes', 'level' => 4, 'evidence' => ['I run clusters at scale'], 'competency_summary' => '?' },
        { 'skill_label' => 'react', 'level' => 5, 'evidence' => [react_quote], 'competency_summary' => 'dup' }
      ])

      labels = generate(FakeGeminiClient.new(response)).portfolio_skills.pluck(:skill_label)

      expect(labels).to contain_exactly('React', 'Communication', 'System Design')
    end
  end
end
