# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Candidate Consent API', type: :request do
  include FactoryHelpers

  let!(:org)        { create_org!(name: 'Test Org', scheme: 'test-corp') }
  let!(:assessment) { create(:assessment, tenant_id: org.id) }
  let!(:session)    { create(:session, assessment: assessment, tenant_id: org.id) }

  describe 'GET /api/v1/candidate/:token — consent info' do
    it 'mengembalikan info session dan status consent untuk invite token valid' do
      get "/api/v1/candidate/#{session.invite_token}"
      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body['consent_required']).to be(true)
      expect(body['has_consent']).to be(false)
      expect(body['organization_name']).to be_present
    end

    it 'mengembalikan 404 untuk token tidak valid' do
      get '/api/v1/candidate/invalid-token-xyz'
      expect(response).to have_http_status(:not_found)
    end

    context 'setelah consent di-grant' do
      before do
        post "/api/v1/candidate/#{session.invite_token}/consent"
      end

      it 'mengembalikan has_consent: true' do
        get "/api/v1/candidate/#{session.invite_token}"
        body = JSON.parse(response.body)
        expect(body['has_consent']).to be(true)
      end
    end
  end

  describe 'POST /api/v1/candidate/:token/consent — grant consent' do
    it 'berhasil grant consent untuk pertama kali' do
      post "/api/v1/candidate/#{session.invite_token}/consent"
      expect(response).to have_http_status(:created)
      body = JSON.parse(response.body)
      expect(body['status']).to eq('granted')
    end

    it 'mengembalikan 200 (idempotent) jika consent sudah ada' do
      post "/api/v1/candidate/#{session.invite_token}/consent"
      post "/api/v1/candidate/#{session.invite_token}/consent"
      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body['status']).to eq('granted')
    end

    it 'mengembalikan 404 untuk token tidak valid' do
      post '/api/v1/candidate/bad-token/consent'
      expect(response).to have_http_status(:not_found)
    end
  end

  describe 'GET /api/v1/candidate/:token/transcript — akses transcript' do
    it 'mengembalikan 403 jika consent belum di-grant' do
      get "/api/v1/candidate/#{session.invite_token}/transcript"
      expect(response).to have_http_status(:forbidden)
    end

    it 'mengembalikan transcript jika consent sudah granted' do
      post "/api/v1/candidate/#{session.invite_token}/consent"
      get "/api/v1/candidate/#{session.invite_token}/transcript"
      expect(response).to have_http_status(:ok)
    end
  end
end
