# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Api::V1::SessionsAppeals', type: :request do
  let!(:org_a) do
    Organization.create!(
      name: 'Tenant A',
      scheme: 'tenant-a',
      identifier: 'tenant-a',
      host: 'tenant-a.com'
    )
  end

  let!(:assessment_a) { Assessment.create!(tenant_id: org_a.id, name: 'Assess A', time_limit_min: 30, created_by: 101) }

  # Normal completed session
  let!(:session_completed) do
    Session.create!(
      tenant_id: org_a.id,
      assessment: assessment_a,
      invite_token: 'token-completed',
      status: 'ended',
      end_reason: 'manual_candidate'
    )
  end

  # Session with system error (eligible for appeal)
  let!(:session_error) do
    Session.create!(
      tenant_id: org_a.id,
      assessment: assessment_a,
      invite_token: 'token-error',
      status: 'ended',
      end_reason: 'error'
    )
  end

  describe 'POST /api/v1/sessions/:token/appeal' do
    it 'allows submitting appeal for error sessions with valid notes' do
      post "/api/v1/sessions/token-error/appeal",
           params: { appeal: { candidate_objection_notes: 'I answered everything well but it got disconnected.' } }

      expect(response).to have_http_status(:created)
      session_error.reload
      expect(session_error.candidate_objection_notes).to eq('I answered everything well but it got disconnected.')
    end

    it 'blocks submitting appeal with notes shorter than 10 characters' do
      post "/api/v1/sessions/token-error/appeal",
           params: { appeal: { candidate_objection_notes: 'Too short' } }

      expect(response).to have_http_status(:unprocessable_entity)
    end

    it 'blocks submitting appeal for non-error completed sessions (Anti-Abuse)' do
      post "/api/v1/sessions/token-completed/appeal",
           params: { appeal: { candidate_objection_notes: 'Valid notes length but session has no technical issue.' } }

      expect(response).to have_http_status(:unprocessable_entity).or(have_http_status(:forbidden))
    end
  end
end
