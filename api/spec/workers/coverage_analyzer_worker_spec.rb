# frozen_string_literal: true

require 'rails_helper'

# What happens to the live coverage maps after each candidate turn (N7). The analyzer's model call is stubbed;
# these specs cover what the worker does with its answer.
RSpec.describe CoverageAnalyzerWorker do
  let(:session) { create(:session, status: 'active') }
  let!(:react)  { create(:coverage_map, session:, skill_label: 'React', state: 'initiated', probe_count: 1) }
  let!(:comms)  { create(:coverage_map, session:, skill_label: 'Communication', state: 'partial', probe_count: 4) }

  let(:redis)     { double("redis", publish: 1) }
  let(:published) { [] }

  def analyzer_returns(skill_updates: [], discovered_skills: [])
    analyzer = instance_double(Coverage::Analyzer, call: { skill_updates:, discovered_skills: })
    allow(Coverage::Analyzer).to receive(:new).with(session:).and_return(analyzer)
  end

  before do
    allow(Sidekiq).to receive(:redis).and_yield(redis)
    allow(redis).to receive(:publish) { |channel, payload| published << [channel, JSON.parse(payload)] }
  end

  def perform = described_class.new.perform(session.id, 3)

  it 'applies the state, probe count and signal the analyzer returns' do
    analyzer_returns(skill_updates: [{ coverage_map_id: react.id, new_state: 'partial', new_probe_count: 2,
                                       last_signal: 'Explained useMemo trade-offs' }])
    perform

    expect(react.reload).to have_attributes(state: 'partial', probe_count: 2, last_signal: 'Explained useMemo trade-offs')
  end

  it 'ignores an update for a coverage map from another session' do
    stranger = create(:coverage_map, state: 'initiated', probe_count: 1)
    analyzer_returns(skill_updates: [{ coverage_map_id: stranger.id, new_state: 'covered', new_probe_count: 5,
                                       last_signal: 'x' }])
    perform

    expect(stranger.reload.state).to eq('initiated')
  end

  it 'adds a discovered skill once, and at most ten' do
    create_list(:coverage_map, 9, session:, is_discovered: true, state: 'initiated')
    analyzer_returns(discovered_skills: [{ label: 'Docker', first_mention: 'We ship with Docker' },
                                         { label: 'Docker', first_mention: 'again' },
                                         { label: 'Kubernetes', first_mention: 'and k8s' }])
    perform

    docker = session.coverage_maps.discovered.find_by(skill_label: 'Docker')
    expect(docker).to have_attributes(skill_id: nil, state: 'initiated', probe_count: 1, last_signal: 'We ship with Docker')
    expect(session.coverage_maps.discovered.count).to eq(10)
    expect(session.coverage_maps.exists?(skill_label: 'Kubernetes')).to be(false)
  end

  it 'advances a partial skill with four or more probes that this turn did not touch' do
    analyzer_returns
    perform

    expect(comms.reload).to have_attributes(state: 'covered', last_signal: /Auto-advanced/)
  end

  it 'does not advance a partial skill this turn just updated' do
    analyzer_returns(skill_updates: [{ coverage_map_id: comms.id, new_state: 'partial', new_probe_count: 5,
                                       last_signal: 'Still going' }])
    perform

    expect(comms.reload.state).to eq('partial')
  end

  it 'publishes the new coverage to the session channel, configured and discovered apart' do
    create(:coverage_map, session:, skill_label: 'Docker', is_discovered: true, state: 'initiated')
    analyzer_returns
    perform

    channel, payload = published.last
    expect(channel).to eq("coverage:#{session.id}")
    expect(payload['type']).to eq('coverage_update')
    expect(payload['skills'].pluck('skill_label')).to eq(%w[React Communication])
    expect(payload['discovered'].pluck('skill_label')).to eq(['Docker'])
  end

  it 'does nothing once the session has ended' do
    session.update!(status: 'ended', end_reason: 'manual_candidate', ended_at: Time.current)
    allow(Coverage::Analyzer).to receive(:new)
    perform

    expect(Coverage::Analyzer).not_to have_received(:new)
    expect(published).to be_empty
  end

  it 'swallows an analyzer failure so the interview goes on' do
    allow(Coverage::Analyzer).to receive(:new).and_raise(StandardError, 'model timeout')

    expect { perform }.not_to raise_error
  end

  it 'skips a session that no longer exists' do
    expect { described_class.new.perform(-1, 1) }.not_to raise_error
  end
end
