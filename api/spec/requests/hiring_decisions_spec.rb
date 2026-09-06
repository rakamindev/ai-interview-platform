# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'HiringDecisions', type: :request do
  include FactoryHelpers

  let!(:org) { create_org!(name: 'Test Org', scheme: 'test-corp') }
  let!(:portfolio) { create(:portfolio, tenant_id: org.id) }

  let(:valid_params) do
    { decision: 'advance', rationale: 'Kandidat menunjukkan pemahaman yang kuat pada semua area yang diujikan.' }.to_json
  end

  let(:assessor_headers_org) { auth_headers_for(user_id: 1, role: 'admin', scheme: org.scheme) }

  describe 'POST /api/v1/portfolios/:portfolio_id/hiring_decision' do
    it 'berhasil membuat hiring decision dengan rationale yang cukup' do
      post "/api/v1/portfolios/#{portfolio.id}/hiring_decision",
           params: valid_params,
           headers: assessor_headers_org
      expect(response).to have_http_status(:created)
      body = JSON.parse(response.body)
      expect(body.dig('hiring_decision', 'decision')).to eq('advance')
      expect(body.dig('hiring_decision', 'is_immutable')).to be(true)
    end

    it 'mengembalikan 422 jika rationale kurang dari 20 karakter' do
      short_rationale = { decision: 'advance', rationale: 'Bagus.' }.to_json
      post "/api/v1/portfolios/#{portfolio.id}/hiring_decision",
           params: short_rationale,
           headers: assessor_headers_org
      expect(response).to have_http_status(:unprocessable_entity)
      body = JSON.parse(response.body)
      expect(body['error']).to include('20')
    end

    it 'mengembalikan 409 jika decision sudah ada (immutable)' do
      # Buat decision pertama
      post "/api/v1/portfolios/#{portfolio.id}/hiring_decision",
           params: valid_params, headers: assessor_headers_org
      # Coba submit lagi
      post "/api/v1/portfolios/#{portfolio.id}/hiring_decision",
           params: valid_params, headers: assessor_headers_org
      expect(response).to have_http_status(:conflict)
    end

    it 'mengembalikan 404 jika portfolio dari tenant lain' do
      other_org = create_org!(name: 'Other Org', scheme: 'other-corp')
      post "/api/v1/portfolios/#{portfolio.id}/hiring_decision",
           params: valid_params,
           headers: auth_headers_for(user_id: 99, role: 'admin', scheme: other_org.scheme)
      expect(response).to have_http_status(:not_found)
    end

    it 'mengembalikan 422 jika decision bukan advance/hold/reject' do
      invalid_params = { decision: 'maybe', rationale: 'Kandidat terlihat cukup baik untuk posisi ini.' }.to_json
      post "/api/v1/portfolios/#{portfolio.id}/hiring_decision",
           params: invalid_params, headers: assessor_headers_org
      expect(response).to have_http_status(:unprocessable_entity)
    end
  end

  describe 'GET /api/v1/portfolios/:portfolio_id/hiring_decision' do
    context 'ketika decision belum ada' do
      it 'mengembalikan 200 dengan hiring_decision: null' do
        get "/api/v1/portfolios/#{portfolio.id}/hiring_decision",
            headers: assessor_headers_org
        expect(response).to have_http_status(:ok)
        body = JSON.parse(response.body)
        expect(body['hiring_decision']).to be_nil
      end
    end

    context 'ketika decision sudah ada' do
      before do
        post "/api/v1/portfolios/#{portfolio.id}/hiring_decision",
             params: valid_params, headers: assessor_headers_org
      end

      it 'mengembalikan decision yang sudah ada' do
        get "/api/v1/portfolios/#{portfolio.id}/hiring_decision",
            headers: assessor_headers_org
        expect(response).to have_http_status(:ok)
        body = JSON.parse(response.body)
        expect(body.dig('hiring_decision', 'decision')).to eq('advance')
      end
    end
  end
end
