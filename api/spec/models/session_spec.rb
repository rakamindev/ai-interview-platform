# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Session do
  it 'generates an unguessable 64-character invite token on create' do
    session = create(:session)

    expect(session.invite_token).to match(/\A\h{64}\z/)
  end

  it 'keeps invite tokens unique' do
    first = create(:session)

    duplicate = build(:session, invite_token: first.invite_token)

    expect(duplicate).not_to be_valid
  end

  it 'rejects unknown statuses and end reasons' do
    expect(build(:session, status: 'paused')).not_to be_valid
    expect(build(:session, end_reason: 'boredom')).not_to be_valid
  end

  describe 'tenant scoping' do
    it 'returns only the current tenant rows once a tenant is set' do
      mine   = create(:session)
      theirs = create(:session)

      RequestStore.store[:tenant_id] = mine.tenant_id

      expect(described_class.all).to contain_exactly(mine)
      expect(described_class.unscoped).to include(theirs)
    end

    it 'fills tenant_id from the current tenant on create' do
      organization = create(:organization)
      RequestStore.store[:tenant_id] = organization.id

      assessment = Assessment.create!(name: 'Role', time_limit_min: 30, created_by: 1)

      expect(assessment.tenant_id).to eq(organization.id)
    end
  end

  describe 'proctoring events' do
    let(:session) { create(:session, status: 'active', started_at: 10.minutes.ago) }
    let(:start) { Time.zone.parse('2026-10-19 10:00:00') }

    it 'records the events the candidate page reports, and nothing else' do
      expect(session.record_proctoring_event!('camera_stopped', at: start)).to be_truthy
      expect(session.record_proctoring_event!('delete_everything', at: start)).to be(false)

      expect(session.reload.proctoring_events).to eq([{ 'event' => 'camera_stopped', 'at' => start.iso8601 }])
    end

    it 'stops recording after the cap, so a page that misbehaves cannot grow the row without limit' do
      Session::MAX_PROCTORING_EVENTS.times { session.record_proctoring_event!('screen_stopped', at: start) }

      expect(session.record_proctoring_event!('screen_resumed', at: start)).to be(false)
      expect(session.reload.proctoring_events.size).to eq(Session::MAX_PROCTORING_EVENTS)
    end

    it 'records a second screen connected and disconnected' do
      expect(session.record_proctoring_event!('second_screen_connected', at: start)).to be_truthy
      expect(session.record_proctoring_event!('second_screen_disconnected', at: start + 30)).to be_truthy

      expect(session.reload.proctoring_events.pluck('event'))
        .to eq(%w[second_screen_connected second_screen_disconnected])
    end

    it 'sums how often and how long a second screen was connected, apart from the camera and the screen share' do
      session.update!(status: 'ended', ended_at: start + 300)
      [['second_screen_connected', 50], ['second_screen_disconnected', 90],
       ['second_screen_connected', 280]].each do |event, offset|
        session.record_proctoring_event!(event, at: start + offset)
      end

      expect(session.proctoring_summary).to include(
        'second_screen' => { connected: 2, seconds: 60 },
        'screen' => { stops: 0, off_seconds: 0 }
      )
    end

    it 'sums how often and how long each was off; a stop with no resume runs to the end' do
      session.update!(status: 'ended', ended_at: start + 300)
      [['camera_stopped', 0], ['camera_resumed', 40], ['camera_stopped', 100], ['camera_resumed', 120],
       ['screen_stopped', 200], ['screen_stopped', 210]].each do |event, offset|
        session.record_proctoring_event!(event, at: start + offset)
      end

      expect(session.proctoring_summary).to eq(
        'camera' => { stops: 2, off_seconds: 60 },
        'screen' => { stops: 1, off_seconds: 100 },
        'second_screen' => { connected: 0, seconds: 0 }
      )
    end
  end

  describe '#invite_url' do
    # Sets APP_BASE_URL (nil removes it) for the block and puts back whatever application.yml had.
    def with_base_url(value)
      original = ENV.fetch('APP_BASE_URL', nil)
      value.nil? ? ENV.delete('APP_BASE_URL') : ENV['APP_BASE_URL'] = value
      yield
    ensure
      original.nil? ? ENV.delete('APP_BASE_URL') : ENV['APP_BASE_URL'] = original
    end

    let(:session) { create(:session) }

    it 'opens the interview page of the web app named by APP_BASE_URL' do
      with_base_url('https://interview.example.com') do
        expect(session.invite_url).to eq("https://interview.example.com/interview/#{session.invite_token}")
      end
    end

    it 'points at the web app, not the API, when APP_BASE_URL is unset (P1-15)' do
      with_base_url(nil) do
        expect(session.invite_url).to eq("http://localhost:5173/interview/#{session.invite_token}")
      end
    end

    it 'gives one slash when APP_BASE_URL ends with one (P1-15)' do
      with_base_url('https://interview.example.com/') do
        expect(session.invite_url).to eq("https://interview.example.com/interview/#{session.invite_token}")
      end
    end
  end
end
