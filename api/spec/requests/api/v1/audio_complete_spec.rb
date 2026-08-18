# frozen_string_literal: true

require 'rails_helper'

# POST /api/v1/sessions/:token/audio_complete takes no JWT — the invite token in
# the URL is the only credential. It used to record end_reason = 'all_covered'
# unconditionally, so a session could be filed as having completed its agenda
# while most of that agenda was never spoken about.
RSpec.describe 'POST /api/v1/sessions/:token/audio_complete' do
  let(:assessment) { create(:assessment, time_limit_min: 10) }
  let(:session)    { create(:session, :active, assessment: assessment) }

  def complete! = post "/api/v1/sessions/#{session.invite_token}/audio_complete"

  context 'when every configured skill was covered' do
    before do
      create(:coverage_map, :covered, session: session)
      create(:coverage_map, :covered, session: session)
    end

    it 'records all_covered' do
      complete!

      expect(session.reload.end_reason).to eq('all_covered')
    end
  end

  context 'when skills were left untouched and the time limit has passed' do
    before do
      session.update!(started_at: 20.minutes.ago)
      create(:coverage_map, :covered,   session: session)
      create(:coverage_map, :untouched, session: session)
    end

    it 'records time_ceiling rather than claiming the agenda was covered' do
      complete!

      expect(session.reload.end_reason).to eq('time_ceiling')
    end
  end

  context 'when skills were left untouched and time remains' do
    before do
      session.update!(started_at: 1.minute.ago)
      create(:coverage_map, :covered,   session: session)
      create(:coverage_map, :untouched, session: session)
    end

    it 'records manual_candidate rather than claiming the agenda was covered' do
      complete!

      expect(session.reload.end_reason).to eq('manual_candidate')
    end
  end

  # The original code skipped the coverage check because re-checking here
  # produced false negatives that stalled auto-end: N7 runs while the AI speaks
  # its closing turn and can add a discovered skill in 'initiated', which flips
  # MapInjector#all_covered? to false between the two moments.
  context 'when the agenda is covered but a discovered skill arrived late' do
    before do
      create(:coverage_map, :covered, session: session)
      create(:coverage_map, :discovered, session: session, skill_label: 'Docker')
    end

    it 'still records all_covered — an off-agenda skill was never on the agenda' do
      complete!

      expect(session.reload.end_reason).to eq('all_covered')
    end
  end

  context 'when no skills were configured at all' do
    it 'does not claim the agenda was covered' do
      complete!

      expect(session.reload.end_reason).not_to eq('all_covered')
    end
  end

  it 'ends the session' do
    create(:coverage_map, :covered, session: session)
    complete!

    expect(session.reload).to be_ended
  end

  # Whatever the coverage says, the session must close. The stall the original
  # comment warned about came from letting this check gate the ending itself.
  it 'ends the session even when nothing was covered' do
    create(:coverage_map, :untouched, session: session)
    complete!

    expect(session.reload).to be_ended
  end

  it 'is idempotent once the session has ended' do
    create(:coverage_map, :covered, session: session)
    complete!
    reason = session.reload.end_reason

    complete!

    expect(session.reload.end_reason).to eq(reason)
  end

  it 'rejects an unknown invite token' do
    post '/api/v1/sessions/not-a-real-token/audio_complete'

    expect(response).to have_http_status(:not_found)
  end
end
