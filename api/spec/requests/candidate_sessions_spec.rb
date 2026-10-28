# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Candidate dashboard', type: :request do
  # Current/RequestStore is a thread-local and the app does not clear it between
  # requests (RequestStore::Middleware is never inserted into the stack), so a
  # tenant resolved in one example would otherwise leak into the next one's
  # queries on the same thread.
  before { Current.clear }
  after  { Current.clear }

  let(:organization) do
    Organization.create!(
      name:       'Dashboard Tenant',
      scheme:     "dash-#{SecureRandom.hex(4)}",
      identifier: "dash-#{SecureRandom.hex(4)}",
      host:       "dash-#{SecureRandom.hex(4)}.test"
    )
  end

  let(:other_organization) do
    Organization.create!(
      name:       'Other Tenant',
      scheme:     "oth-#{SecureRandom.hex(4)}",
      identifier: "oth-#{SecureRandom.hex(4)}",
      host:       "oth-#{SecureRandom.hex(4)}.test"
    )
  end

  let(:candidate) do
    User.create!(
      email:    "cand-#{SecureRandom.hex(4)}@example.test",
      password: 'password123',
      role:     'user'
    )
  end

  let(:other_candidate) do
    User.create!(
      email:    "other-#{SecureRandom.hex(4)}@example.test",
      password: 'password123',
      role:     'user'
    )
  end

  let(:assessment) do
    Assessment.create!(
      tenant_id:      organization.id,
      created_by:     1,
      name:           'Backend engineer',
      time_limit_min: 45
    )
  end

  let(:other_assessment) do
    Assessment.create!(
      tenant_id:      other_organization.id,
      created_by:     1,
      name:           'Frontend engineer',
      time_limit_min: 30
    )
  end

  def headers_for(user, scheme: organization.scheme)
    token = JsonWebToken.encode({ user_id: user.id, role: user.role, scheme: scheme })
    { 'Authorization' => "Bearer #{token}" }
  end

  def session_for(attrs = {})
    Session.create!(
      { tenant_id: organization.id, assessment: assessment, candidate_email: candidate.email }.merge(attrs)
    )
  end

  def listed_ids
    response.parsed_body['sessions'].map { |row| row['id'] }
  end

  describe 'GET /api/v1/candidate/sessions' do
    it 'rejects a request without a token' do
      # The tenant header isolates the auth check: with no tenant at all the
      # tenant filter rejects the request first (covered below).
      get '/api/v1/candidate/sessions', headers: { 'X-Tenant-Scheme' => organization.scheme }

      expect(response).to have_http_status(:unauthorized)
    end

    it 'rejects a request that cannot resolve a tenant' do
      get '/api/v1/candidate/sessions'

      expect(response).to have_http_status(:forbidden)
    end

    it 'lists an upcoming interview assigned to the candidate email' do
      session = session_for

      get '/api/v1/candidate/sessions', headers: headers_for(candidate)

      expect(response).to have_http_status(:ok)
      expect(listed_ids).to eq([session.id])

      row = response.parsed_body['sessions'].first
      expect(row).to include(
        'status'         => 'pending',
        'role_title'     => 'Backend engineer',
        'time_limit_min' => 45,
        'invite_token'   => session.invite_token
      )
      expect(row['ended_at']).to be_nil
    end

    it 'lists an interview claimed by user id' do
      session = session_for(candidate_email: nil, candidate_id: candidate.id)

      get '/api/v1/candidate/sessions', headers: headers_for(candidate)

      expect(listed_ids).to eq([session.id])
    end

    it 'lists a legacy session whose candidate_name is the candidate email' do
      session = session_for(candidate_email: nil, candidate_name: candidate.email.upcase)

      get '/api/v1/candidate/sessions', headers: headers_for(candidate)

      expect(listed_ids).to eq([session.id])
    end

    it 'reports a completed interview with its duration' do
      session_for(
        status:           'ended',
        end_reason:       'manual_candidate',
        started_at:       5.minutes.ago,
        ended_at:         Time.current,
        duration_seconds: 120
      )

      get '/api/v1/candidate/sessions', headers: headers_for(candidate)

      row = response.parsed_body['sessions'].first
      expect(row['status']).to eq('ended')
      expect(row['duration_seconds']).to eq(120)
      expect(row['ended_at']).to be_present
    end

    it "never exposes another candidate's interviews" do
      session_for(candidate_email: other_candidate.email)

      get '/api/v1/candidate/sessions', headers: headers_for(candidate)

      expect(response).to have_http_status(:ok)
      expect(listed_ids).to be_empty
    end

    it "never exposes another tenant's interviews, even for the same email" do
      Session.create!(
        tenant_id:       other_organization.id,
        assessment:      other_assessment,
        candidate_email: candidate.email
      )

      get '/api/v1/candidate/sessions', headers: headers_for(candidate)

      expect(listed_ids).to be_empty
    end

    it 'orders interviews newest first' do
      older = session_for(created_at: 2.days.ago)
      newer = session_for(created_at: Time.current)

      get '/api/v1/candidate/sessions', headers: headers_for(candidate)

      expect(listed_ids).to eq([newer.id, older.id])
    end

    it 'still refuses a candidate token on assessor endpoints' do
      get '/api/v1/assessments', headers: headers_for(candidate)

      expect(response).to have_http_status(:forbidden)
    end
  end
end
