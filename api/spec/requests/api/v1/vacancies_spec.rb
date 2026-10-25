# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Vacancies API', type: :request do
  let(:tenant_scheme) { 'test-corp' }
  let(:assessor_token) do
    JsonWebToken.encode({ user_id: 1, role: 'assessor', scheme: tenant_scheme })
  end
  let(:auth_headers) do
    {
      'Authorization' => "Bearer #{assessor_token}",
      'X-Tenant-Scheme' => tenant_scheme,
      'Content-Type' => 'application/json'
    }
  end

  describe 'GET /api/v1/vacancies' do
    it 'returns list of vacancies' do
      Vacancy.create!(role_title: 'Senior DevOps Engineer', tenant_id: 'tenant-123')

      get '/api/v1/vacancies', headers: auth_headers

      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)
      expect(json['vacancies']).to be_an(Array)
      expect(json['vacancies'].first['role_title']).to eq('Senior DevOps Engineer')
    end
  end

  describe 'POST /api/v1/vacancies' do
    it 'creates a vacancy with nested skills' do
      payload = {
        vacancy: {
          role_title: 'Staff Fullstack Engineer',
          culture_dimensions: 'High ownership, customer obsession',
          competency_expectations: 'Demonstrated experience shipping large scale features',
          vacancy_skills_attributes: [
            {
              skill_label: 'TypeScript & React',
              expected_level: 4
            }
          ]
        }
      }

      post '/api/v1/vacancies', params: payload.to_json, headers: auth_headers

      expect(response).to have_http_status(:created)
      json = JSON.parse(response.body)
      expect(json['vacancy']['role_title']).to eq('Staff Fullstack Engineer')
      expect(json['vacancy']['skills'].length).to eq(1)
      expect(json['vacancy']['skills'].first['expected_level']).to eq(4)
    end

    it 'returns 422 if role_title is missing' do
      payload = { vacancy: { role_title: '' } }

      post '/api/v1/vacancies', params: payload.to_json, headers: auth_headers

      expect(response).to have_http_status(:unprocessable_entity)
    end
  end

  describe 'GET /api/v1/vacancies/:id' do
    it 'returns vacancy details' do
      vacancy = Vacancy.create!(role_title: 'Engineering Manager', tenant_id: 'tenant-123')

      get "/api/v1/vacancies/#{vacancy.id}", headers: auth_headers

      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)
      expect(json['vacancy']['role_title']).to eq('Engineering Manager')
    end

    it 'returns 404 when vacancy not found' do
      get '/api/v1/vacancies/9999999', headers: auth_headers

      expect(response).to have_http_status(:not_found)
    end
  end
end
