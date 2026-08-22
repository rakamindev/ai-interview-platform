# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Api::V1::Assessments', type: :request do
  let(:user) { create(:user, :admin) }
  let(:headers) { auth_headers(user_id: user.id) }

  before { stub_tenant }

  describe 'GET /api/v1/assessments' do
    before do
      create_list(:assessment, 3, tenant_id: 1, created_by: user.id)
      get '/api/v1/assessments', headers: headers
    end

    it 'returns HTTP 200 with assessments list' do
      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)
      expect(json['assessments'].length).to eq(3)
    end
  end

  describe 'POST /api/v1/assessments' do
    context 'with valid params' do
      it 'returns HTTP 201' do
        post '/api/v1/assessments',
             params: { assessment: { name: 'Frontend Dev', time_limit_min: 30 } },
             headers: headers
        expect(response).to have_http_status(:created)
      end
    end

    context 'with missing name' do
      it 'returns HTTP 422' do
        post '/api/v1/assessments',
             params: { assessment: { name: '', time_limit_min: 30 } },
             headers: headers
        expect(response).to have_http_status(:unprocessable_entity)
      end
    end
  end

  describe 'DELETE /api/v1/assessments/:id' do
    it 'returns HTTP 200' do
      assessment = create(:assessment, tenant_id: 1, created_by: user.id)
      delete "/api/v1/assessments/#{assessment.id}", headers: headers
      expect(response).to have_http_status(:ok)
    end
  end
end
