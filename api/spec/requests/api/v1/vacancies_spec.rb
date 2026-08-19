# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Vacancies API', type: :request do
  let(:organization) { create(:organization) }
  let(:vacancy) { create(:vacancy, organization: organization, public_requirement_text: 'Must know Ruby.') }
  let(:headers) { auth_headers(user_id: 1, role: 'assessor', scheme: organization.scheme) }

  describe 'GET /api/v1/vacancies/:id/deletion_check' do
    it 'is deletable when no CV screening references it' do
      vacancy

      get "/api/v1/vacancies/#{vacancy.id}/deletion_check", headers: headers

      expect(response).to have_http_status(:ok)
      expect(json_body['deletable']).to eq(true)
    end

    it 'is not deletable when a CV screening references it, and names the blocker' do
      screening = create(:cv_screening, vacancy: vacancy, organization: organization)

      get "/api/v1/vacancies/#{vacancy.id}/deletion_check", headers: headers

      expect(response).to have_http_status(:ok)
      expect(json_body['deletable']).to eq(false)
      expect(json_body['reason']).to eq('cv_screenings')
      expect(json_body['blocking_cv_screenings']).to contain_exactly(
        { 'id' => screening.id, 'name' => screening.name }
      )
    end
  end

  describe 'DELETE /api/v1/vacancies/:id' do
    it 'deletes the vacancy and cascades its versions' do
      vacancy
      # The after_save callback already stamped at least one version.
      expect(VacancyVersion.where(vacancy_id: vacancy.id).count).to be >= 1

      delete "/api/v1/vacancies/#{vacancy.id}", headers: headers

      expect(response).to have_http_status(:ok)
      expect(Vacancy.find_by(id: vacancy.id)).to be_nil
      expect(VacancyVersion.where(vacancy_id: vacancy.id)).to be_empty
    end

    it 'refuses to delete a vacancy used by a CV screening, and leaves it untouched' do
      screening = create(:cv_screening, vacancy: vacancy, organization: organization)

      delete "/api/v1/vacancies/#{vacancy.id}", headers: headers

      expect(response).to have_http_status(:unprocessable_entity)
      expect(Vacancy.find(vacancy.id)).to eq(vacancy)
      expect(json_body['errors'].first['detail']['blocking_cv_screenings']).to contain_exactly(
        { 'id' => screening.id, 'name' => screening.name }
      )
    end
  end
end
