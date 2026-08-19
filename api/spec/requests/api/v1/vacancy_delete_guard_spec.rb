require 'rails_helper'

RSpec.describe 'Vacancy delete guard (F-009)', type: :request do
  let(:organization) { create(:organization) }
  let(:headers)        { assessor_auth_headers(organization) }

  describe 'GET /api/v1/vacancies exposes fit_gap_reports_count' do
    it 'is 0 for a vacancy with no fit-gap reports' do
      create(:vacancy, tenant_id: organization.id)

      get '/api/v1/vacancies', headers: headers

      body = JSON.parse(response.body)
      expect(body['vacancies'].first['fit_gap_reports_count']).to eq(0)
    end

    it 'reflects the real count for a vacancy with fit-gap reports' do
      vacancy = create(:vacancy, tenant_id: organization.id)
      create_list(:fit_gap_report, 2, vacancy: vacancy)

      get '/api/v1/vacancies', headers: headers

      body = JSON.parse(response.body)
      expect(body['vacancies'].first['fit_gap_reports_count']).to eq(2)
    end
  end

  describe 'DELETE /api/v1/vacancies/:id' do
    it 'deletes a vacancy with no fit-gap reports' do
      vacancy = create(:vacancy, tenant_id: organization.id)

      delete "/api/v1/vacancies/#{vacancy.id}", headers: headers

      expect(response).to have_http_status(:ok)
      expect(Vacancy.exists?(vacancy.id)).to be false
    end

    it 'still allows deleting a vacancy with fit-gap reports (cascade is intentional once confirmed client-side), but the count was disclosed beforehand' do
      vacancy = create(:vacancy, tenant_id: organization.id)
      create(:fit_gap_report, vacancy: vacancy)

      delete "/api/v1/vacancies/#{vacancy.id}", headers: headers

      expect(response).to have_http_status(:ok)
      expect(Vacancy.exists?(vacancy.id)).to be false
      expect(FitGapReport.where(vacancy_id: vacancy.id)).to be_empty
    end
  end
end
