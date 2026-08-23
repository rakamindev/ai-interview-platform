# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Api::V1::Vacancies', type: :request do
  let(:organization) { create(:organization) }
  let(:user) { create(:user, role: 'admin') }
  let(:headers) { authenticated_header(user, organization: organization) }

  describe 'GET /api/v1/vacancies' do
    it 'returns vacancies scoped to current tenant' do
      create_list(:vacancy, 2, tenant_id: organization.id)

      get '/api/v1/vacancies', headers: headers

      expect(response).to have_http_status(:ok)
      expect(json_response['vacancies'].length).to eq(2)
    end
  end

  describe 'POST /api/v1/vacancies' do
    it 'creates a vacancy with nested vacancy_skills' do
      payload = {
        role_title: 'Staff Backend Engineer',
        culture_dimensions: 'High ownership, radical candor',
        competency_expectations: 'Event-driven architectures, Go/Ruby',
        vacancy_skills_attributes: [
          { skill_label: 'Node.js / Backend', expected_level: 4 }
        ]
      }

      post '/api/v1/vacancies', params: payload.to_json, headers: headers

      expect(response).to have_http_status(:created)
      expect(json_response['vacancy']['role_title']).to eq('Staff Backend Engineer')
      expect(json_response['vacancy']['skills'].length).to eq(1)
    end
  end
end
