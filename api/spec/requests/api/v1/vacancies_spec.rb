# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Api::V1::Vacancies', type: :request do
  let(:admin) { create(:admin) }
  let(:headers) { auth_json_headers(admin) }

  describe 'GET /api/v1/vacancies' do
    before { create_list(:vacancy, 3) }

    it 'returns paginated vacancies' do
      get '/api/v1/vacancies', headers: headers

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body['vacancies'].length).to eq(3)
      expect(body['meta']).to be_present
    end
  end

  describe 'GET /api/v1/vacancies/:id' do
    let(:vacancy) { create(:vacancy, :with_skills) }

    it 'returns vacancy with skills and taxonomy anchors' do
      skill = vacancy.vacancy_skills.first
      taxonomy = create(:skill_taxonomy, skill_id: skill.skill_id)

      get "/api/v1/vacancies/#{vacancy.id}", headers: headers

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body['vacancy']['skills']).to be_present
      expect(body['vacancy']['skills'].first['l1_anchor']).to eq(taxonomy.l1_anchor)
    end
  end

  describe 'POST /api/v1/vacancies' do
    it 'creates a vacancy' do
      expect {
        post '/api/v1/vacancies',
             params: { vacancy: { role_title: 'Senior Engineer' } }.to_json,
             headers: headers
      }.to change(Vacancy, :count).by(1)

      expect(response).to have_http_status(:created)
    end
  end

  describe 'PUT /api/v1/vacancies/:id' do
    let(:vacancy) { create(:vacancy) }

    it 'updates the vacancy' do
      put "/api/v1/vacancies/#{vacancy.id}",
          params: { vacancy: { role_title: 'Updated Title' } }.to_json,
          headers: headers

      expect(response).to have_http_status(:ok)
      expect(vacancy.reload.role_title).to eq('Updated Title')
    end
  end

  describe 'DELETE /api/v1/vacancies/:id' do
    let!(:vacancy) { create(:vacancy) }

    it 'deletes the vacancy' do
      expect {
        delete "/api/v1/vacancies/#{vacancy.id}", headers: headers
      }.to change(Vacancy, :count).by(-1)

      expect(response).to have_http_status(:ok)
    end
  end
end
