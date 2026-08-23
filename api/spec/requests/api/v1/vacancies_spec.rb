# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Api::V1::Vacancies', type: :request do
  let(:user) { create(:user, :admin) }
  let(:headers) { auth_headers(user) }

  before { with_tenant }

  describe 'GET /api/v1/vacancies' do
    let!(:vacancy1) { create(:vacancy, role_title: 'Role 1', tenant_id: 1) }
    let!(:vacancy2) { create(:vacancy, role_title: 'Role 2', tenant_id: 1) }
    let!(:other_tenant_vacancy) { create(:vacancy, role_title: 'Other Tenant', tenant_id: 2) }

    it 'returns paginated vacancies for current tenant' do
      get '/api/v1/vacancies', headers: headers

      expect_json_response
      expect(json_body['vacancies'].size).to eq(2)
      expect(json_body['meta']).to be_present
    end
  end

  describe 'GET /api/v1/vacancies/:id' do
    let!(:vacancy) { create(:vacancy, :with_skills, tenant_id: 1) }

    it 'returns vacancy with skills' do
      get "/api/v1/vacancies/#{vacancy.id}", headers: headers

      expect_json_response
      expect(json_body['vacancy']['id']).to eq(vacancy.id)
      expect(json_body['vacancy']['skills']).to be_present
    end
  end

  describe 'POST /api/v1/vacancies' do
    let(:valid_params) do
      {
        vacancy: {
          role_title: 'New Role',
          culture_dimensions: 'Team player',
          competency_expectations: 'Strong skills',
          vacancy_skills_attributes: [
            { skill_id: 'SK-VAC-001', skill_label: 'Test Skill', expected_level: 3 }
          ]
        }
      }
    end

    it 'creates vacancy' do
      expect {
        post '/api/v1/vacancies', params: valid_params, headers: headers
      }.to change(Vacancy, :count).by(1)

      expect_json_response(status: :created)
      expect(json_body['vacancy']['role_title']).to eq('New Role')
    end
  end

  describe 'PUT /api/v1/vacancies/:id' do
    let!(:vacancy) { create(:vacancy, tenant_id: 1) }

    it 'updates vacancy' do
      put "/api/v1/vacancies/#{vacancy.id}",
          params: { vacancy: { role_title: 'Updated Role' } },
          headers: headers

      expect_json_response
      expect(json_body['vacancy']['role_title']).to eq('Updated Role')
    end
  end

  describe 'DELETE /api/v1/vacancies/:id' do
    let!(:vacancy) { create(:vacancy, tenant_id: 1) }

    it 'deletes vacancy' do
      expect {
        delete "/api/v1/vacancies/#{vacancy.id}", headers: headers
      }.to change(Vacancy, :count).by(-1)

      expect_json_response
    end
  end
end