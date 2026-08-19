# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Api::V1::Assessments', type: :request do
  let(:admin) { create(:admin) }
  let(:headers) { auth_json_headers(admin) }

  describe 'GET /api/v1/assessments' do
    before { create_list(:assessment, 3) }

    it 'returns paginated assessments' do
      get '/api/v1/assessments', headers: headers

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body['assessments'].length).to eq(3)
      expect(body['meta']).to be_present
    end

    it 'requires authentication' do
      get '/api/v1/assessments'
      expect(response).to have_http_status(:unauthorized)
    end
  end

  describe 'GET /api/v1/assessments/:id' do
    let(:assessment) { create(:assessment, :with_skills) }

    it 'returns assessment with skills' do
      get "/api/v1/assessments/#{assessment.id}", headers: headers

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body['assessment']['name']).to eq(assessment.name)
      expect(body['assessment']['skills']).to be_present
    end

    it 'returns 404 for non-existent assessment' do
      get '/api/v1/assessments/999999', headers: headers
      expect(response).to have_http_status(:not_found)
    end
  end

  describe 'POST /api/v1/assessments' do
    let(:valid_params) do
      {
        assessment: {
          name: 'Test Assessment',
          time_limit_min: 30,
          language: 'en'
        }
      }
    end

    it 'creates an assessment' do
      expect {
        post '/api/v1/assessments', params: valid_params.to_json, headers: headers
      }.to change(Assessment, :count).by(1)

      expect(response).to have_http_status(:created)
    end

    it 'returns errors for invalid params' do
      post '/api/v1/assessments', params: { assessment: { name: '' } }.to_json, headers: headers
      expect(response).to have_http_status(:unprocessable_entity)
    end
  end

  describe 'PUT /api/v1/assessments/:id' do
    let(:assessment) { create(:assessment) }

    it 'updates the assessment' do
      put "/api/v1/assessments/#{assessment.id}",
          params: { assessment: { name: 'Updated Name' } }.to_json,
          headers: headers

      expect(response).to have_http_status(:ok)
      expect(assessment.reload.name).to eq('Updated Name')
    end
  end

  describe 'DELETE /api/v1/assessments/:id' do
    let!(:assessment) { create(:assessment) }

    it 'deletes the assessment' do
      expect {
        delete "/api/v1/assessments/#{assessment.id}", headers: headers
      }.to change(Assessment, :count).by(-1)

      expect(response).to have_http_status(:ok)
    end
  end
end
