# frozen_string_literal: true

require 'rails_helper'

# The consent flow is candidate-facing: no JWT, no tenant, only the invite
# token from the URL. These specs cover the two endpoints and, more
# importantly, the two properties that make a consent record worth having —
# that it cannot be forged from the client, and that it cannot be duplicated.
RSpec.describe 'Candidate consent', type: :request do
  let(:organization) { create(:organization) }
  let(:session)      { create(:session, tenant_id: organization.id) }

  describe 'GET /api/v1/sessions/:token/candidate' do
    it 'returns the consent wording with the record not yet granted' do
      get "/api/v1/sessions/#{session.invite_token}/candidate"

      expect(response).to have_http_status(:ok)
      consent = json_response['consent']
      expect(consent['version']).to eq(ConsentText::VERSION)
      expect(consent['required']).to be true
      expect(consent['granted']).to be false
    end

    it 'discloses six of the seven items UU PDP Pasal 21(1) requires' do
      get "/api/v1/sessions/#{session.invite_token}/candidate"

      labels = json_response['consent']['details'].map { |d| d['label'] }

      # Asserted as an exact ordered list rather than a subset, so a
      # disclosure dropped later fails here instead of going unnoticed.
      #
      # (d), the retention period, is the one deliberately missing: no
      # retention period has been decided, so none is claimed.
      expect(labels).to eq(
        [
          'Legal basis',                      # (a)
          'Purpose',                          # (b)
          'Why this data is relevant to you', # (c)
          'What we collect',                  # (e)
          'How long we process it',           # (f)
          'Your rights'                       # (g)
        ]
      )
    end

    it 'claims no retention period, because none has been decided' do
      get "/api/v1/sessions/#{session.invite_token}/candidate"

      labels = json_response['consent']['details'].map { |d| d['label'] }

      expect(labels).not_to include('How long we keep it')
    end

    it 'names no vendor, since the model behind the assessment can change' do
      get "/api/v1/sessions/#{session.invite_token}/candidate"

      everything = (json_response['consent']['summary'] +
                    json_response['consent']['details'].map { |d| d['text'] }).join(' ')

      expect(everything).to match(/\bAI\b/)
      expect(everything).not_to match(/\b(Google|Gemini|OpenAI|Anthropic|Claude)\b/i)
    end

    it 'states that voice is sent but raw audio is not retained' do
      get "/api/v1/sessions/#{session.invite_token}/candidate"

      everything = (json_response['consent']['summary'] +
                    json_response['consent']['details'].map { |d| d['text'] }).join(' ')

      expect(everything).to include('biometric')
      expect(everything).to include('not kept after the session')
    end

    it 'reports an existing consent as granted' do
      create(:consent, session: session)

      get "/api/v1/sessions/#{session.invite_token}/candidate"

      expect(json_response['consent']['granted']).to be true
      expect(json_response['consent']['accepted_at']).to be_present
    end
  end

  describe 'POST /api/v1/sessions/:token/consent' do
    it 'records consent and marks it granted' do
      expect { post "/api/v1/sessions/#{session.invite_token}/consent" }
        .to change(Consent, :count).by(1)

      expect(response).to have_http_status(:ok)
      expect(json_response['consent']['granted']).to be true
      expect(json_response['consent']['version']).to eq(ConsentText::VERSION)
    end

    it 'sets consented_at on the server, not from the client' do
      Timecop.freeze(Time.current) do
        post "/api/v1/sessions/#{session.invite_token}/consent",
             params: { consented_at: '1999-01-01T00:00:00Z', version: 'hacked' }

        record = Consent.find_by(session_id: session.id)
        expect(record.version).to eq(ConsentText::VERSION)
        expect(record.consented_at).to be_within(1.second).of(Time.current)
      end
    end

    it 'is idempotent — clicking twice creates one record and keeps the original time' do
      post "/api/v1/sessions/#{session.invite_token}/consent"
      first_time = Consent.find_by!(session_id: session.id).consented_at

      Timecop.travel(5.minutes) do
        post "/api/v1/sessions/#{session.invite_token}/consent"
      end

      expect(Consent.where(session_id: session.id).count).to eq(1)
      expect(Consent.find_by(session_id: session.id).consented_at).to eq(first_time)
    end

    it 'asks again when the wording changed since the candidate last agreed' do
      create(:consent, :stale, session: session)

      get "/api/v1/sessions/#{session.invite_token}/candidate"
      expect(json_response['consent']['granted']).to be false

      post "/api/v1/sessions/#{session.invite_token}/consent"

      record = Consent.find_by!(session_id: session.id)
      expect(record.version).to eq(ConsentText::VERSION)
      expect(record.consented_at).to be_within(1.second).of(Time.current)
    end

    it 'refuses a session that has already ended' do
      ended = create(:session, :ended, tenant_id: organization.id)

      post "/api/v1/sessions/#{ended.invite_token}/consent"

      expect(response).to have_http_status(:unprocessable_entity)
      expect(Consent.where(session_id: ended.id)).to be_empty
    end

    it 'refuses an unknown invite token with 404' do
      post '/api/v1/sessions/not-a-real-token/consent'

      expect(response).to have_http_status(:not_found)
      expect(Consent.count).to eq(0)
    end

    it 'is protected by the database, not only by validation' do
      create(:consent, session: session)

      # Validation is skipped deliberately. A concurrent request passes
      # validation on both sides and only the unique index can stop it, so
      # this has to go through to the database to prove anything.
      expect do
        Consent.new(session: session, version: ConsentText::VERSION, consented_at: Time.current)
               .save!(validate: false)
      end.to raise_error(ActiveRecord::RecordNotUnique)
    end

    it 'cannot be forged by a candidate editing the request body' do
      post "/api/v1/sessions/#{session.invite_token}/consent",
           params: { version: 'v0', consented_at: '2000-01-01', ip_address: '1.2.3.4' }

      record = Consent.find_by!(session_id: session.id)

      expect(record.version).to eq(ConsentText::VERSION)
      expect(record).not_to respond_to(:ip_address)
    end
  end
end
