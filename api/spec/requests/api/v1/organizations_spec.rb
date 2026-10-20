# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Api::V1::Organizations', type: :request do
  let!(:org) do
    Organization.create!(
      name: 'Acme Enterprise',
      scheme: 'acme-enterprise',
      identifier: 'acme-enterprise',
      host: 'acme.test',
      config: {
        'ai' => {
          'gemini_api_key' => 'AIzaSyOriginalKey1234567890',
          'models' => {
            'live' => 'gemini-custom-live',
            'flash' => 'gemini-custom-flash',
            'pro' => 'gemini-custom-pro'
          },
          'voice' => 'Puck',
          'temperature' => 0.4
        }
      }
    )
  end

  let(:token) do
    JsonWebToken.encode({ user_id: 1, role: 'assessor', scheme: org.scheme })
  end

  describe 'GET /api/v1/organization/ai_config' do
    it 'returns 401 when request lacks authorization' do
      get '/api/v1/organization/ai_config', headers: { 'X-Tenant-Scheme' => org.scheme }
      expect(response).to have_http_status(:unauthorized)
    end

    it 'returns 200 with masked credentials and AI parameters' do
      get '/api/v1/organization/ai_config', headers: { 'Authorization' => "Bearer #{token}" }

      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)
      expect(json['ai_config']).to be_present
      expect(json['ai_config']['custom_ai_configured']).to be true
      expect(json['ai_config']['gemini_api_key_configured']).to be true
      expect(json['ai_config']['masked_gemini_api_key']).to eq('AIzaSy...7890')
      expect(json['ai_config']['models']['live']).to eq('gemini-custom-live')
      expect(json['ai_config']['voice']).to eq('Puck')
      expect(json['ai_config']['temperature']).to eq(0.4)
      expect(json['ai_config']['allowed_voices']).to include('Puck', 'Charon', 'Aoede', 'Fenrir', 'Kore')
    end
  end

  describe 'PATCH /api/v1/organization/ai_config' do
    it 'returns 401 when unauthenticated' do
      patch '/api/v1/organization/ai_config', params: { voice: 'Fenrir' }, headers: { 'X-Tenant-Scheme' => org.scheme }
      expect(response).to have_http_status(:unauthorized)
    end

    it 'updates AI configuration parameters and returns updated config' do
      patch '/api/v1/organization/ai_config',
            params: {
              gemini_api_key: 'AIzaSyUpdatedSecretKey9999',
              voice: 'Fenrir',
              temperature: 0.7,
              models: {
                live: 'gemini-2.0-flash-exp',
                pro: 'gemini-2.0-pro-exp-02-05'
              }
            },
            headers: { 'Authorization' => "Bearer #{token}" }

      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)
      expect(json['ai_config']['masked_gemini_api_key']).to eq('AIzaSy...9999')
      expect(json['ai_config']['voice']).to eq('Fenrir')
      expect(json['ai_config']['temperature']).to eq(0.7)
      expect(json['ai_config']['models']['live']).to eq('gemini-2.0-flash-exp')

      reloaded_org = org.reload
      expect(reloaded_org.gemini_api_key).to eq('AIzaSyUpdatedSecretKey9999')
      expect(reloaded_org.gemini_voice).to eq('Fenrir')
      expect(reloaded_org.gemini_temperature).to eq(0.7)
    end

    it 'returns 422 unprocessable_entity when voice is invalid' do
      patch '/api/v1/organization/ai_config',
            params: { voice: 'InvalidVoiceName' },
            headers: { 'Authorization' => "Bearer #{token}" }

      expect(response).to have_http_status(:unprocessable_entity)
    end
  end
end
