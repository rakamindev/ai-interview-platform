# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Coverage::Analyzer do
  let(:assessment) { create(:assessment, :with_prd02_skills) }
  let(:session)    { create(:session, :active, assessment: assessment) }
  let(:client)     { instance_double(Gemini::HttpClient) }

  subject(:analyzer) { described_class.new(session: session, gemini_client: client) }

  # probe_count is bounded by how often the candidate has actually spoken, so a
  # fixture that claims two probes needs at least two candidate turns behind it.
  before { given_candidate_turns(6) }

  def given_candidate_turns(count)
    # delete_all on the class, not destroy_all on the association: the proxy
    # caches, and a cached-empty collection would delete nothing while leaving
    # the rows in the database.
    TranscriptTurn.where(session_id: session.id).delete_all
    (1..count).each do |i|
      create(:transcript_turn, session: session, turn_number: (i * 2) - 1, speaker: 'ai',
                               text: "Follow-up number #{i}.")
      create(:transcript_turn, session: session, turn_number: i * 2, speaker: 'candidate',
                               text: "We profiled the dashboard and cut re-renders by sixty percent (#{i}).")
    end
  end

  def map_for(label, state:, probe_count:)
    create(:coverage_map, session: session, skill_label: label, state: state, probe_count: probe_count)
  end

  def responds_with(updates: [], discovered: [])
    allow(client).to receive(:generate_content)
      .and_return({ 'skill_updates' => updates, 'discovered_skills' => discovered })
  end

  def update_for(label, state:, probe_count:)
    { 'id' => label.downcase.gsub(/\s+/, '-'), 'new_state' => state,
      'new_probe_count' => probe_count, 'reason' => 'because the candidate said so' }
  end

  describe 'the sliding-window probe cap' do
    it 'raises the count by at most one per run, however inflated the proposal' do
      map_for('React', state: 'partial', probe_count: 2)
      responds_with(updates: [update_for('React', state: 'covered', probe_count: 9)])

      update = analyzer.call[:skill_updates].first

      expect(update[:new_probe_count]).to eq(3)
    end

    it 'never lets the count fall backwards' do
      map_for('React', state: 'partial', probe_count: 5)
      responds_with(updates: [update_for('React', state: 'partial', probe_count: 1)])

      update = analyzer.call[:skill_updates].first

      expect(update[:new_probe_count]).to eq(5)
    end
  end

  # AC-1. `covered` is terminal for the *state* — the sliding window keeps
  # showing old turns and would otherwise re-open a finished skill. But freezing
  # the *evidence count* alongside it is what makes `high` confidence
  # unreachable: a skill reaches `covered` at the floor of probe_count 2 and
  # can never climb to the 3 that `high` requires. Depth of evidence and
  # readiness to stop probing are two different questions.
  describe 'evidence depth after a skill is covered' do
    it 'keeps counting probes' do
      map_for('React', state: 'covered', probe_count: 2)
      responds_with(updates: [update_for('React', state: 'covered', probe_count: 3)])

      update = analyzer.call[:skill_updates].first

      expect(update).to be_present
      expect(update[:new_probe_count]).to eq(3)
    end

    it 'still refuses to move the state' do
      map_for('React', state: 'covered', probe_count: 3)
      responds_with(updates: [update_for('React', state: 'partial', probe_count: 4)])

      update = analyzer.call[:skill_updates].first

      expect(update[:new_state]).to eq('covered')
    end

    it 'still caps the increment at one per run' do
      map_for('React', state: 'covered', probe_count: 2)
      responds_with(updates: [update_for('React', state: 'covered', probe_count: 8)])

      expect(analyzer.call[:skill_updates].first[:new_probe_count]).to eq(3)
    end

    # Letting a covered skill keep counting reopens the door the freeze was
    # holding shut: the sliding window would nudge it upward on every remaining
    # turn of the interview. Bound it by something true rather than by a magic
    # number — you cannot probe a skill more often than the candidate has spoken.
    it 'never counts more probes than the candidate has taken turns' do
      given_candidate_turns(2)
      map_for('React', state: 'covered', probe_count: 2)
      responds_with(updates: [update_for('React', state: 'covered', probe_count: 3)])

      expect(analyzer.call[:skill_updates].first[:new_probe_count]).to eq(2)
    end
  end

  describe 'defending against malformed model output' do
    it 'ignores a state outside the vocabulary and keeps the current one' do
      map_for('React', state: 'initiated', probe_count: 2)
      responds_with(updates: [update_for('React', state: 'transcendent', probe_count: 3)])

      expect(analyzer.call[:skill_updates].first[:new_state]).to eq('initiated')
    end

    it 'coerces a non-numeric probe count instead of crashing' do
      map_for('React', state: 'partial', probe_count: 2)
      responds_with(updates: [update_for('React', state: 'partial', probe_count: nil)])

      expect { analyzer.call }.not_to raise_error
      expect(analyzer.call[:skill_updates].first[:new_probe_count]).to eq(2)
    end

    it 'drops updates naming a skill this session does not have' do
      map_for('React', state: 'partial', probe_count: 2)
      responds_with(updates: [update_for('Underwater Basket Weaving', state: 'covered', probe_count: 3)])

      expect(analyzer.call[:skill_updates]).to be_empty
    end

    it 'returns an empty result rather than raising when the response is not JSON' do
      map_for('React', state: 'partial', probe_count: 2)
      allow(client).to receive(:generate_content).and_return('the model decided to write prose')

      expect(analyzer.call).to eq(skill_updates: [], discovered_skills: [])
    end
  end

  describe 'when there is nothing to analyse' do
    it 'does not call the model at all for an empty transcript' do
      TranscriptTurn.where(session_id: session.id).delete_all
      expect(client).not_to receive(:generate_content)

      expect(analyzer.call).to eq(skill_updates: [], discovered_skills: [])
    end
  end

  describe 'off-agenda discoveries' do
    it 'passes them through with the mention that produced them' do
      map_for('React', state: 'partial', probe_count: 2)
      responds_with(discovered: [{ 'label' => 'Micro-frontends',
                                   'first_mention' => 'Split the app with Module Federation' }])

      discovered = analyzer.call[:discovered_skills].first

      expect(discovered[:label]).to eq('Micro-frontends')
      expect(discovered[:first_mention]).to eq('Split the app with Module Federation')
    end
  end

  describe 'the prompt sent to the model' do
    it 'fences the transcript as untrusted so a candidate cannot inject instructions' do
      map_for('React', state: 'not_yet', probe_count: 0)
      expect(client).to receive(:generate_content) do |prompt, **|
        expect(prompt).to include('BEGIN UNTRUSTED TRANSCRIPT')
        expect(prompt).to include('END UNTRUSTED TRANSCRIPT')
        { 'skill_updates' => [], 'discovered_skills' => [] }
      end

      analyzer.call
    end
  end
end
