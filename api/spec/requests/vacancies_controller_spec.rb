# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Api::V1::VacanciesController, type: :request do # rubocop:disable Metrics/BlockLength
  let(:tenant_a) { create(:organization) }
  let(:tenant_b) { create(:organization) }
  let(:headers_a) { auth_header_for(organization: tenant_a) }
  let(:headers_b) { auth_header_for(organization: tenant_b) }

  let!(:vacancy_a) { create(:vacancy, tenant_id: tenant_a.id) }
  let!(:vacancy_b) { create(:vacancy, tenant_id: tenant_b.id) }

  describe 'GET /api/v1/vacancies' do
    it 'lists only vacancies from the caller tenant' do
      get '/api/v1/vacancies', headers: headers_a

      expect(response).to have_http_status(:ok)
      ids = response.parsed_body['vacancies'].map { |v| v['id'] }
      expect(ids).to include(vacancy_a.id)
      expect(ids).not_to include(vacancy_b.id)
    end

    it 'requires an assessor token' do
      get '/api/v1/vacancies'

      expect(response).to have_http_status(:unauthorized)
    end
  end

  describe 'GET /api/v1/vacancies/:id' do
    it 'blocks reading another tenant vacancy' do
      get "/api/v1/vacancies/#{vacancy_b.id}", headers: headers_a

      expect(response).to have_http_status(:not_found)
    end

    it 'shows own vacancy with skills and taxonomy anchors' do
      create(:vacancy_skill, vacancy: vacancy_a, skill_id: 'ruby', expected_level: 4)
      create(:skill_taxonomy, skill_id: 'ruby')

      get "/api/v1/vacancies/#{vacancy_a.id}", headers: headers_a

      expect(response).to have_http_status(:ok)
      skill = response.parsed_body['vacancy']['skills'].first
      expect(skill['expected_level']).to eq(4)
      expect(skill['l1_anchor']).to eq('L1 anchor')
    end
  end

  describe 'POST /api/v1/vacancies' do
    it 'creates a vacancy with nested skills' do
      post '/api/v1/vacancies',
           params: { vacancy: {
             role_title: 'Backend Engineer',
             culture_dimensions: 'High ownership',
             competency_expectations: 'SQL, Rails',
             vacancy_skills_attributes: [
               { skill_id: 'ruby', skill_label: 'Ruby', expected_level: 3 }
             ]
           } },
           headers: headers_a

      expect(response).to have_http_status(:created)
      vacancy = Vacancy.last
      expect(vacancy.tenant_id).to eq(tenant_a.id)
      expect(vacancy.vacancy_skills.count).to eq(1)
    end

    it 'rejects a vacancy without role_title' do
      post '/api/v1/vacancies',
           params: { vacancy: { role_title: '' } },
           headers: headers_a

      expect(response).to have_http_status(:unprocessable_entity)
    end
  end

  describe 'PUT /api/v1/vacancies/:id' do
    it 'destroys skills marked with _destroy' do
      keep = create(:vacancy_skill, vacancy: vacancy_a, expected_level: 3)
      drop = create(:vacancy_skill, vacancy: vacancy_a, expected_level: 4)

      put "/api/v1/vacancies/#{vacancy_a.id}",
          params: { vacancy: {
            role_title: vacancy_a.role_title,
            vacancy_skills_attributes: [
              { id: drop.id, _destroy: true },
              { id: keep.id, _destroy: false }
            ]
          } },
          headers: headers_a

      expect(response).to have_http_status(:ok)
      expect(vacancy_a.reload.vacancy_skills.pluck(:id)).to eq([keep.id])
    end

    it 'blocks updating another tenant vacancy' do
      put "/api/v1/vacancies/#{vacancy_b.id}",
          params: { vacancy: { role_title: 'Hacked' } },
          headers: headers_a

      expect(response).to have_http_status(:not_found)
      expect(vacancy_b.reload.role_title).not_to eq('Hacked')
    end
  end

  describe 'DELETE /api/v1/vacancies/:id' do
    it 'deletes own vacancy' do
      expect do
        delete "/api/v1/vacancies/#{vacancy_a.id}", headers: headers_a
      end.to change(Vacancy, :count).by(-1)

      expect(response).to have_http_status(:ok)
    end

    it 'blocks deleting another tenant vacancy' do
      delete "/api/v1/vacancies/#{vacancy_b.id}", headers: headers_a

      expect(response).to have_http_status(:not_found)
      expect(Vacancy.exists?(vacancy_b.id)).to be(true)
    end
  end
end
