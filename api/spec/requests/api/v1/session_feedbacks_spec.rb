# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Api::V1::SessionFeedbacks', type: :request do
  let(:org_a) do
    Organization.find_or_create_by!(id: 1) do |o|
      o.name = 'Acme Corp'
      o.scheme = 'acme'
      o.identifier = 'acme'
      o.host = 'acme.example.com'
    end
  end

  let(:org_b) do
    Organization.find_or_create_by!(id: 2) do |o|
      o.name = 'Beta Ltd'
      o.scheme = 'beta'
      o.identifier = 'beta'
      o.host = 'beta.example.com'
    end
  end

  let(:assessment_a) do
    Assessment.create!(
      tenant_id: org_a.id,
      created_by: 1,
      name: 'Fullstack Dev Assessment',
      time_limit_min: 30,
      language: 'en'
    )
  end

  let(:session_a) do
    Session.create!(
      tenant_id: org_a.id,
      assessment: assessment_a,
      candidate_id: 101,
      candidate_name: 'John Doe',
      invite_token: 'valid_token_xyz_123',
      status: 'ended'
    )
  end

  let(:valid_headers_a) do
    token = JsonWebToken.encode({ user_id: 1, role: 'admin', scheme: org_a.scheme })
    { 'Authorization' => "Bearer #{token}", 'Content-Type' => 'application/json' }
  end

  let(:valid_headers_b) do
    token = JsonWebToken.encode({ user_id: 2, role: 'admin', scheme: org_b.scheme })
    { 'Authorization' => "Bearer #{token}", 'Content-Type' => 'application/json' }
  end

  # ============================================================================
  # POST /api/v1/sessions/:token/feedback (Candidate-facing, No JWT)
  # ============================================================================
  describe 'POST /api/v1/sessions/:token/feedback' do
    let(:valid_payload) do
      {
        feedback: {
          rating: 5,
          experience_tag: 'smooth',
          feedback_text: 'The AI interviewer was responsive and helpful.',
          has_complaint: false
        }
      }
    end

    context 'Happy path' do
      it 'creates feedback and returns 201 with feedback payload' do
        post "/api/v1/sessions/#{session_a.invite_token}/feedback",
             params: valid_payload.to_json,
             headers: { 'Content-Type' => 'application/json' }

        expect(response).to have_http_status(:created)
        json = JSON.parse(response.body)

        expect(json['feedback']).to be_present
        expect(json['feedback']['rating']).to eq(5)
        expect(json['feedback']['experience_tag']).to eq('smooth')
        expect(json['feedback']['has_complaint']).to be false
        expect(json['feedback']['submitted_at']).to be_present

        # Verify database record
        fb = session_a.reload.session_feedback
        expect(fb).to be_present
        expect(fb.rating).to eq(5)
        expect(fb.tenant_id).to eq(session_a.tenant_id)
      end

      it 'creates feedback with complaint details when has_complaint is true' do
        payload = {
          feedback: {
            rating: 2,
            experience_tag: 'technical_issue',
            feedback_text: 'Audio was choppy',
            has_complaint: true,
            complaint_text: 'The AI mic cut out around the 10 minute mark.'
          }
        }

        post "/api/v1/sessions/#{session_a.invite_token}/feedback",
             params: payload.to_json,
             headers: { 'Content-Type' => 'application/json' }

        expect(response).to have_http_status(:created)
        json = JSON.parse(response.body)
        expect(json['feedback']['has_complaint']).to be true
        expect(json['feedback']['complaint_text']).to eq('The AI mic cut out around the 10 minute mark.')
      end
    end

    context 'Failure & edge cases' do
      it 'returns 404 when session invite token does not exist' do
        post '/api/v1/sessions/nonexistent_token_999/feedback',
             params: valid_payload.to_json,
             headers: { 'Content-Type' => 'application/json' }

        expect(response).to have_http_status(:not_found)
      end

      it 'returns 422 when feedback has already been submitted for the session' do
        SessionFeedback.create!(
          session: session_a,
          tenant_id: session_a.tenant_id,
          rating: 4,
          has_complaint: false
        )

        post "/api/v1/sessions/#{session_a.invite_token}/feedback",
             params: valid_payload.to_json,
             headers: { 'Content-Type' => 'application/json' }

        expect(response).to have_http_status(:unprocessable_entity)
        json = JSON.parse(response.body)
        expect(json['errors'][0]['message']).to include('already been submitted')
      end

      it 'returns 422 when rating is missing' do
        payload = { feedback: { experience_tag: 'smooth', has_complaint: false } }

        post "/api/v1/sessions/#{session_a.invite_token}/feedback",
             params: payload.to_json,
             headers: { 'Content-Type' => 'application/json' }

        expect(response).to have_http_status(:unprocessable_entity)
      end

      it 'returns 422 when rating is out of bounds (e.g. 0 or 6)' do
        [0, 6, -1].each do |bad_rating|
          payload = { feedback: { rating: bad_rating, has_complaint: false } }

          post "/api/v1/sessions/#{session_a.invite_token}/feedback",
               params: payload.to_json,
               headers: { 'Content-Type' => 'application/json' }

          expect(response).to have_http_status(:unprocessable_entity)
        end
      end

      it 'returns 422 when has_complaint is true but complaint_text is missing' do
        payload = {
          feedback: {
            rating: 2,
            has_complaint: true,
            complaint_text: ''
          }
        }

        post "/api/v1/sessions/#{session_a.invite_token}/feedback",
             params: payload.to_json,
             headers: { 'Content-Type' => 'application/json' }

        expect(response).to have_http_status(:unprocessable_entity)
      end

      it 'returns 422 when root feedback parameter is missing' do
        post "/api/v1/sessions/#{session_a.invite_token}/feedback",
             params: { rating: 5 }.to_json,
             headers: { 'Content-Type' => 'application/json' }

        expect(response).to have_http_status(:unprocessable_entity)
      end

      it 'handles SQL injection attempt in feedback text safely' do
        sql_payload = {
          feedback: {
            rating: 3,
            feedback_text: "'); DROP TABLE session_feedbacks; --",
            has_complaint: false
          }
        }

        post "/api/v1/sessions/#{session_a.invite_token}/feedback",
             params: sql_payload.to_json,
             headers: { 'Content-Type' => 'application/json' }

        expect(response).to have_http_status(:created)
        expect(session_a.reload.session_feedback.feedback_text).to eq("'); DROP TABLE session_feedbacks; --")
        expect(ActiveRecord::Base.connection.table_exists?(:session_feedbacks)).to be true
      end

      it 'handles XSS content in feedback text safely as verbatim text' do
        xss_payload = {
          feedback: {
            rating: 4,
            feedback_text: "<script>alert('xss')</script><img src=x onerror=alert(1)>",
            has_complaint: false
          }
        }

        post "/api/v1/sessions/#{session_a.invite_token}/feedback",
             params: xss_payload.to_json,
             headers: { 'Content-Type' => 'application/json' }

        expect(response).to have_http_status(:created)
        expect(session_a.reload.session_feedback.feedback_text).to include("<script>")
      end
    end
  end

  # ============================================================================
  # GET /api/v1/sessions/:id/feedback (Assessor-facing, Requires JWT)
  # ============================================================================
  describe 'GET /api/v1/sessions/:id/feedback' do
    let!(:existing_feedback) do
      SessionFeedback.create!(
        session: session_a,
        tenant_id: org_a.id,
        rating: 4,
        experience_tag: 'smooth',
        feedback_text: 'Great interview setup',
        has_complaint: false
      )
    end

    context 'Happy path with authentication' do
      it 'returns 200 with feedback payload for assessor from same tenant' do
        get "/api/v1/sessions/#{session_a.id}/feedback", headers: valid_headers_a

        expect(response).to have_http_status(:ok)
        json = JSON.parse(response.body)
        expect(json['feedback']).to be_present
        expect(json['feedback']['rating']).to eq(4)
        expect(json['feedback']['experience_tag']).to eq('smooth')
      end

      it 'returns 200 with feedback: null when session has no feedback submitted yet' do
        existing_feedback.destroy!

        get "/api/v1/sessions/#{session_a.id}/feedback", headers: valid_headers_a

        expect(response).to have_http_status(:ok)
        json = JSON.parse(response.body)
        expect(json['feedback']).to be_nil
      end
    end

    context 'Security & Authorization' do
      it 'returns 403 when Authorization header is missing (tenant unresolvable)' do
        get "/api/v1/sessions/#{session_a.id}/feedback"
        expect(response).to have_http_status(:forbidden)
      end

      it 'returns 403 when Authorization token is malformed (tenant unresolvable)' do
        get "/api/v1/sessions/#{session_a.id}/feedback",
            headers: { 'Authorization' => 'Bearer invalid_garbage_token' }
        expect(response).to have_http_status(:forbidden)
      end

      it 'returns 403 when user role is not authorized (e.g. candidate)' do
        candidate_token = JsonWebToken.encode({ user_id: 99, role: 'candidate', scheme: org_a.scheme })
        get "/api/v1/sessions/#{session_a.id}/feedback",
            headers: { 'Authorization' => "Bearer #{candidate_token}" }
        expect(response).to have_http_status(:forbidden)
      end

      it 'enforces tenant isolation: assessor from Tenant B cannot access Tenant A session feedback' do
        get "/api/v1/sessions/#{session_a.id}/feedback", headers: valid_headers_b

        # Because of default_scope { where(tenant_id: current_tenant_id) },
        # Tenant A's session is invisible to Tenant B, resulting in 404
        expect(response).to have_http_status(:not_found)
      end

      it 'returns 404 for nonexistent session ID' do
        get '/api/v1/sessions/999999/feedback', headers: valid_headers_a
        expect(response).to have_http_status(:not_found)
      end
    end
  end
end
