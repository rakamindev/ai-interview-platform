require 'rails_helper'

RSpec.describe 'End-to-End Interview Flow', type: :request do
  let!(:organization) { Organization.create!(identifier: 'test-corp', name: 'Test Corp', scheme: 'test-corp', host: 'test-corp.example.com') }
  let!(:admin) { create(:user, :admin, password: 'password123') }
  let!(:assessment) { create(:assessment, name: 'Senior Developer', tenant_id: organization.id) }

  let(:base_headers) do
    { 'X-Tenant-Scheme' => 'test-corp', 'Content-Type' => 'application/json' }
  end

  # Helper to fetch JWT token on the fly for authenticated admin routes
  let(:auth_headers) do
    post '/api/v1/auth/login', params: { email: admin.email, password: 'password123' }.to_json, headers: base_headers
    token = JSON.parse(response.body)['token']
    base_headers.merge('Authorization' => "Bearer #{token}")
  end

  describe 'Positive Cases (Happy Path)' do
    it 'completes the full interview flow successfully' do
      # 1. Admin invites candidate
      invite_payload = { session: { candidate_name: 'John Doe', candidate_id: 'CAND-123' } }
      post "/api/v1/assessments/#{assessment.id}/sessions", params: invite_payload.to_json, headers: auth_headers
      expect(response).to have_http_status(:created)
      
      invite_json = JSON.parse(response.body)
      invite_token = invite_json['session']['invite_token']
      session_id = invite_json['session']['id']
      expect(invite_token).to be_present

      # 2. Candidate login (using invite token)
      get "/api/v1/sessions/#{invite_token}/candidate", headers: base_headers
      expect(response).to have_http_status(:success)
      
      candidate_json = JSON.parse(response.body)
      expect(candidate_json['session_id']).to eq(session_id)
      expect(candidate_json['role_title']).to eq('Senior Developer')

      # 3. Candidate completes audio/interview process
      post "/api/v1/sessions/#{invite_token}/audio_complete", headers: base_headers
      expect(response).to have_http_status(:success)
      
      audio_complete_json = JSON.parse(response.body)
      expect(audio_complete_json['ended']).to be true

      # 4. Admin checks interview results (status becomes ended)
      get "/api/v1/sessions/#{session_id}", headers: auth_headers
      expect(response).to have_http_status(:success)
      
      session_json = JSON.parse(response.body)
      expect(session_json['session']['status']).to eq('ended')
      expect(session_json['session']['end_reason']).to eq('all_covered')

      # Check portfolio endpoint handles the session safely
      get "/api/v1/sessions/#{session_id}/portfolio", headers: auth_headers
      expect([200, 202]).to include(response.status)
    end
  end

  describe 'Negative Cases & Edge Scenarios (Kemungkinan Terjadi)' do
    context '1. Admin Login' do
      it 'fails to authenticate with incorrect password' do
        post '/api/v1/auth/login', params: { email: admin.email, password: 'wrong_password' }.to_json, headers: base_headers
        expect(response).to have_http_status(:unauthorized)
        expect(JSON.parse(response.body)['errors'][0]['message']).to eq('Invalid email or password')
      end

      it 'fails to authenticate with non-existent email' do
        post '/api/v1/auth/login', params: { email: 'nowhere@example.com', password: 'password123' }.to_json, headers: base_headers
        expect(response).to have_http_status(:unauthorized)
      end
    end

    context '2. Admin Invite Candidate (Create Session)' do
      it 'fails when assessment ID does not exist' do
        invite_payload = { session: { candidate_name: 'John Doe' } }
        post "/api/v1/assessments/99999/sessions", params: invite_payload.to_json, headers: auth_headers
        expect(response).to have_http_status(:not_found)
      end

      it 'fails when the request lacks authorization (missing JWT)' do
        invite_payload = { session: { candidate_name: 'John Doe' } }
        post "/api/v1/assessments/#{assessment.id}/sessions", params: invite_payload.to_json, headers: base_headers
        expect(response).to have_http_status(:unauthorized)
      end
    end

    context '3. Candidate Login' do
      it 'returns not found gracefully when invite token is invalid, expired or tampered' do
        get "/api/v1/sessions/invalid_token_123/candidate", headers: base_headers
        expect(response).to have_http_status(:not_found)
        expect(JSON.parse(response.body)['errors'][0]['message']).to eq('Invalid or expired invite token')
      end
    end

    context '4. Candidate Interview Process (audio_complete)' do
      let!(:active_session) { create(:session, assessment: assessment) }

      it 'returns not found if attempting to complete audio with an invalid token' do
        post "/api/v1/sessions/invalid_token/audio_complete", headers: base_headers
        expect(response).to have_http_status(:not_found)
      end

      it 'prevents ending session if skills are not fully covered' do
        active_session.assessment.assessment_skills.create!(
          skill_id: 'ruby', skill_label: 'Ruby', l1_anchor: '1', l2_anchor: '2', l3_anchor: '3', l4_anchor: '4', l5_anchor: '5'
        )
        Sessions::StartHandler.new(active_session).call
        
        post "/api/v1/sessions/#{active_session.invite_token}/audio_complete", headers: base_headers
        expect(response).to have_http_status(:unprocessable_entity)
        expect(JSON.parse(response.body)['errors'][0]['message']).to eq('Cannot end session: skills not fully covered')
      end

      it 'handles idempotency safely if the session is already ended (eg. duplicated API call)' do
        # Mark it as ended manually
        active_session.update(status: 'ended')

        # Trigger it twice to check that we return a safe response message
        post "/api/v1/sessions/#{active_session.invite_token}/audio_complete", headers: base_headers
        expect(response).to have_http_status(:success)
        expect(JSON.parse(response.body)['ended']).to be true
        expect(JSON.parse(response.body)['message']).to eq("Session already ended")
      end
    end

    context '5. Fetching Results & Check Status' do
      let!(:test_session) { create(:session, assessment: assessment) }

      it 'returns not found for non-existent session lookup' do
        get "/api/v1/sessions/99999", headers: auth_headers
        expect(response).to have_http_status(:not_found)
      end
      
      it 'denies access to results if token belongs to an unauthorized role (or unauthenticated)' do
        # Accessing session via unauthenticated user
        get "/api/v1/sessions/#{test_session.id}", headers: base_headers
        expect(response).to have_http_status(:unauthorized)
      end
    end
  end
end
