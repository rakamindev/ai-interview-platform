# frozen_string_literal: true

require 'rails_helper'

# N5: starting a session activates it and seeds one coverage row per configured
# skill, so every skill is tracked from the first turn.
RSpec.describe Sessions::StartHandler do
  let(:assessment) { create(:assessment, :with_skills) }
  let(:session)    { create(:session, assessment:) }

  it 'activates the session and records when it started' do
    freeze_time do
      described_class.new(session).call

      expect(session.reload).to have_attributes(status: 'active', started_at: Time.current)
    end
  end

  it 'seeds a not_yet coverage row for every configured skill, in display order' do
    described_class.new(session).call

    expect(session.coverage_maps.order(:id).map { [_1.skill_label, _1.state, _1.probe_count, _1.is_discovered] })
      .to eq([['React', 'not_yet', 0, false], ['Communication', 'not_yet', 0, false], ['System Design', 'not_yet', 0, false]])
  end

  it 'does not reset coverage when the candidate reconnects and the session starts again' do
    described_class.new(session).call
    session.coverage_maps.find_by!(skill_label: 'React').update!(state: 'partial', probe_count: 2)

    described_class.new(session.reload).call

    expect(session.coverage_maps.count).to eq(3)
    expect(session.coverage_maps.find_by!(skill_label: 'React')).to have_attributes(state: 'partial', probe_count: 2)
  end

  it 'starts a session with no configured skills without seeding anything' do
    empty = create(:session)

    described_class.new(empty).call

    expect(empty.reload.status).to eq('active')
    expect(empty.coverage_maps).to be_empty
  end
end
