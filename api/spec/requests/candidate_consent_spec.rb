# frozen_string_literal: true

require 'rails_helper'

# The candidate is the one person in this system who never chose to be here and
# cannot opt out of being assessed, so the disclosure has to reach them before
# anything is captured, and the record of it has to survive.
RSpec.describe 'Candidate consent', type: :request do
  let(:assessment) { create(:assessment, :with_prd02_skills) }
  let(:session)    { create(:session, assessment: assessment) }
  let(:token)      { session.invite_token }

  # No Authorization header anywhere below. A candidate holds an invite token
  # and nothing else, which is the entire point.
  let(:headers) { { 'CONTENT_TYPE' => 'application/json' } }

  def body = JSON.parse(response.body).fetch('data', JSON.parse(response.body))

  describe 'GET /api/v1/sessions/:token/disclosure' do
    it 'tells the candidate what will happen, without an account' do
      get "/api/v1/sessions/#{token}/disclosure", headers: headers

      expect(response).to have_http_status(:ok)
      expect(body['disclosure']).to include(
        'recorded', 'assessed_by_ai', 'human_review', 'third_party', 'stored', 'rights'
      )
    end

    it 'names the third party the speech is sent to' do
      get "/api/v1/sessions/#{token}/disclosure", headers: headers

      expect(body.dig('disclosure', 'third_party')).to match(/gemini/i)
    end

    it 'says a human can change the rating, because that is the right being protected' do
      get "/api/v1/sessions/#{token}/disclosure", headers: headers

      expect(body.dig('disclosure', 'human_review')).to match(/human|assessor/i)
    end

    it 'reports that consent has not been given yet' do
      get "/api/v1/sessions/#{token}/disclosure", headers: headers

      expect(body['consent_granted']).to be false
    end

    it 'refuses an invite token that does not exist' do
      get '/api/v1/sessions/not-a-real-token/disclosure', headers: headers

      expect(response).to have_http_status(:not_found)
    end
  end

  describe 'POST /api/v1/sessions/:token/consent' do
    it 'records the agreement' do
      post "/api/v1/sessions/#{token}/consent", headers: headers

      expect(response).to have_http_status(:created)
      expect(session.reload).to be_consented
    end

    it 'stamps the version of the wording the candidate actually read' do
      post "/api/v1/sessions/#{token}/consent", headers: headers

      expect(session.reload.candidate_consent.disclosure_version).to eq(CandidateConsent::CURRENT_VERSION)
    end

    it 'records when it was given' do
      post "/api/v1/sessions/#{token}/consent", headers: headers

      expect(session.reload.candidate_consent.granted_at).to be_present
    end

    # A candidate who reloads the page, or whose connection drops mid-request,
    # must not be told they have done something wrong. They have already agreed.
    describe 'when the candidate has already agreed' do
      before { post "/api/v1/sessions/#{token}/consent", headers: headers }

      it 'says so rather than failing' do
        post "/api/v1/sessions/#{token}/consent", headers: headers

        expect(response).to have_http_status(:ok)
        expect(body['already_granted']).to be true
      end

      it 'keeps one record, not two' do
        2.times { post "/api/v1/sessions/#{token}/consent", headers: headers }

        expect(CandidateConsent.where(session_id: session.id).count).to eq(1)
      end

      it 'does not move the timestamp on the original agreement' do
        first = session.reload.candidate_consent.granted_at

        post "/api/v1/sessions/#{token}/consent", headers: headers

        expect(session.reload.candidate_consent.granted_at).to eq(first)
      end
    end

    it 'refuses an invite token that does not exist' do
      post '/api/v1/sessions/not-a-real-token/consent', headers: headers

      expect(response).to have_http_status(:not_found)
      expect(CandidateConsent.count).to eq(0)
    end
  end

  describe 'what the candidate landing page knows' do
    it 'reports consent status so the interview can be gated on it' do
      get "/api/v1/sessions/#{token}/candidate", headers: headers
      expect(body['consent_granted']).to be false

      post "/api/v1/sessions/#{token}/consent", headers: headers

      get "/api/v1/sessions/#{token}/candidate", headers: headers
      expect(body['consent_granted']).to be true
    end
  end

  describe 'what the record deliberately does not hold' do
    before { post "/api/v1/sessions/#{token}/consent", headers: headers }

    # This table exists to prove a disclosure was shown. Holding the candidate's
    # name or anything they said would work against the law it serves.
    it 'stores no name and no interview content' do
      columns = CandidateConsent.column_names

      expect(columns).not_to include('candidate_name', 'text', 'transcript', 'email')
    end
  end
end
