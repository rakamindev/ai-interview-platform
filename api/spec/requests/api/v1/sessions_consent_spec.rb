# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Candidate consent API', type: :request do
  let(:organization) { create(:organization) }
  let(:assessment) { create(:assessment, organization:) }
  let(:session) { create(:session, organization:, assessment:, status: 'pending') }
  let(:version) { Session::CONSENT_VERSION }

  def record_consent(accepted:, version: Session::CONSENT_VERSION, token: session.invite_token)
    post "/api/v1/sessions/#{token}/consent",
         params:  { consent: { accepted:, version: } },
         as:      :json
  end

  describe 'recording a decision' do
    it 'records an acceptance with its notice version' do
      record_consent(accepted: true)

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body).fetch('consent')
      expect(body).to include('accepted' => true, 'declined' => false, 'version' => version)

      session.reload
      expect(session.consent_accepted_at).to be_present
      expect(session.consent_version).to eq(version)
      expect(session.consent_declined_at).to be_nil
    end

    it 'records a decline as a successful outcome that clears any acceptance' do
      session.update!(consent_accepted_at: 1.hour.ago, consent_version: version)

      record_consent(accepted: false)

      expect(response).to have_http_status(:ok)
      expect(JSON.parse(response.body).fetch('consent')).to include('accepted' => false, 'declined' => true)

      session.reload
      expect(session.consent_declined_at).to be_present
      expect(session.consent_accepted_at).to be_nil
      expect(session.consent_version).to be_nil
    end

    it 'flips back to accepted when a declining candidate changes their mind' do
      record_consent(accepted: false)
      expect(session.reload.consent_declined?).to be(true)

      record_consent(accepted: true)

      expect(response).to have_http_status(:ok)
      session.reload
      expect(session.consent_accepted?).to be(true)
      expect(session.consent_declined?).to be(false)
    end
  end

  describe 'rejections' do
    it 'answers 404 for an unknown invite token' do
      record_consent(accepted: true, token: 'not-a-real-token')

      expect(response).to have_http_status(:not_found)
      expect(JSON.parse(response.body).fetch('errors').first.fetch('message')).to eq(
        'Invalid or expired invite token'
      )
    end

    it 'rejects a notice version that is not current' do
      record_consent(accepted: true, version: 'v0')

      expect(response).to have_http_status(:unprocessable_entity)
      expect(JSON.parse(response.body).fetch('errors').first.fetch('message')).to eq(
        'Consent version is out of date'
      )
      expect(session.reload.consent_accepted_at).to be_nil
    end

    it 'rejects a blank notice version' do
      record_consent(accepted: true, version: nil)

      expect(response).to have_http_status(:unprocessable_entity)
      expect(JSON.parse(response.body).fetch('errors').first.fetch('message')).to eq(
        'Consent version is out of date'
      )
    end

    it 'rejects a decision that is not a boolean' do
      post "/api/v1/sessions/#{session.invite_token}/consent",
           params:  { consent: { accepted: 'yes', version: } },
           as:      :json

      expect(response).to have_http_status(:unprocessable_entity)
      expect(JSON.parse(response.body).fetch('errors').first.fetch('message')).to eq(
        'Consent decision must be true or false'
      )
      expect(session.reload.consent_accepted_at).to be_nil
    end
  end

  describe 'an ended session' do
    it 'reports the recorded decision without changing it' do
      session.update!(status: 'ended', ended_at: Time.current, consent_accepted_at: 2.hours.ago, consent_version: version)

      record_consent(accepted: false)

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body).fetch('consent')
      expect(body).to include('accepted' => true, 'session_ended' => true)

      session.reload
      expect(session.consent_accepted?).to be(true)
      expect(session.consent_declined_at).to be_nil
    end
  end

  describe 'GET /api/v1/sessions/:token/candidate' do
    it 'reports consent as not yet given for a fresh invitation' do
      get "/api/v1/sessions/#{session.invite_token}/candidate"

      expect(response).to have_http_status(:ok)
      expect(JSON.parse(response.body).fetch('consent')).to eq(
        'required' => true,
        'accepted' => false,
        'declined' => false,
        'version' => version
      )
    end

    it 'reports the recorded decision once the candidate accepted' do
      record_consent(accepted: true)

      get "/api/v1/sessions/#{session.invite_token}/candidate"

      expect(response).to have_http_status(:ok)
      expect(JSON.parse(response.body).fetch('consent')).to include('accepted' => true, 'declined' => false)
    end
  end

  describe 'server-side enforcement' do
    it 'refuses to start a session without an accepted notice' do
      handler = Sessions::StartHandler.new(session)

      expect(handler.call).to be_nil
      expect(handler.refusal_reason).to eq('consent_required')
      expect(session.reload.status).to eq('pending')
      expect(session.started_at).to be_nil
    end

    it 'starts the session once consent is recorded' do
      session.update!(consent_accepted_at: Time.current, consent_version: version)

      started = Sessions::StartHandler.new(session).call

      expect(started).to eq(session.reload)
      expect(session.status).to eq('active')
      expect(session.started_at).to be_present
    end
  end
end
