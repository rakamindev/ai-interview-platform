# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'WebSocket Authorization', type: :request do
  let!(:org_a) do
    Organization.create!(
      name: 'Tenant A',
      scheme: 'tenant-a',
      identifier: 'tenant-a',
      host: 'tenant-a.com'
    )
  end

  let!(:org_b) do
    Organization.create!(
      name: 'Tenant B',
      scheme: 'tenant-b',
      identifier: 'tenant-b',
      host: 'tenant-b.com'
    )
  end

  let!(:assessment_a) { Assessment.create!(tenant_id: org_a.id, name: 'Assess A', time_limit_min: 30, created_by: 101) }
  let!(:session_a) do
    Session.create!(
      tenant_id: org_a.id,
      assessment: assessment_a,
      invite_token: 'token-a-session',
      status: 'active'
    )
  end

  # Valid Assessor Token for Tenant A
  let(:assessor_token_a) { JsonWebToken.encode({ user_id: 101, role: 'assessor', scheme: 'tenant-a' }) }
  # Candidate Token for Tenant A (candidates have role: 'candidate')
  let(:candidate_token_a) { JsonWebToken.encode({ user_id: 201, role: 'candidate', scheme: 'tenant-a' }) }
  # Assessor Token for Tenant B
  let(:assessor_token_b) { JsonWebToken.encode({ user_id: 102, role: 'assessor', scheme: 'tenant-b' }) }

  describe 'Coverage WebSocket Authentication' do
    it 'accepts connection for assessors within the same tenant' do
      middleware = CoverageWebSocketMiddleware.new(nil)
      token = assessor_token_a
      session, error = middleware.send(:authenticate_assessor_by_token, token, session_a.id)

      expect(error).to be_nil
      expect(session).to eq(session_a)
    end

    it 'rejects connection if the role is candidate (role validation)' do
      middleware = CoverageWebSocketMiddleware.new(nil)
      token = candidate_token_a
      session, error = middleware.send(:authenticate_assessor_by_token, token, session_a.id)

      # We expect role validation to reject candidates from accessing assessor coverage.
      expect(error).not_to be_nil
      expect(session).to be_nil
    end

    it 'rejects connection if the assessor belongs to a different tenant (BOLA/IDOR)' do
      middleware = CoverageWebSocketMiddleware.new(nil)
      token = assessor_token_b
      session, error = middleware.send(:authenticate_assessor_by_token, token, session_a.id)

      expect(error).not_to be_nil
      expect(session).to be_nil
    end
  end

  describe 'Audio WebSocket Authentication' do
    it 'accepts connection for candidates with the correct session invite token' do
      middleware = AudioWebSocketMiddleware.new(nil)
      env = {
        'rack.input' => StringIO.new,
        'QUERY_STRING' => "token=#{session_a.invite_token}"
      }
      session, error = middleware.send(:authenticate_and_load, env, session_a.id.to_s)

      expect(error).to be_nil
      expect(session).to eq(session_a)
    end

    it 'rejects connection if the session invite token is from a different tenant session' do
      middleware = AudioWebSocketMiddleware.new(nil)
      env = {
        'rack.input' => StringIO.new,
        'QUERY_STRING' => "token=invalid-token"
      }
      session, error = middleware.send(:authenticate_and_load, env, session_a.id.to_s)

      expect(error).not_to be_nil
      expect(session).to be_nil
    end

    it 'rejects connection if an authenticated JWT belongs to a candidate (role validation SEC-02)' do
      middleware = AudioWebSocketMiddleware.new(nil)
      env = {
        'rack.input' => StringIO.new,
        'HTTP_AUTHORIZATION' => "Bearer #{candidate_token_a}"
      }
      session, error = middleware.send(:authenticate_and_load, env, session_a.id.to_s)

      expect(error).not_to be_nil
      expect(error).to match(/Unauthorized role/)
      expect(session).to be_nil
    end
  end
end
