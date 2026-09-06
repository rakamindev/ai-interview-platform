# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Vacancies API', type: :request do
  let(:organization) { create(:organization, scheme: 'test-corp') }
  let!(:user) { create(:user, email: 'assessor@test.com') }
  let(:token) do
    login_get_token(email: 'assessor@test.com', password: 'password123')
  end
  let(:headers) { tenant_headers.merge(auth_headers(token)) }

  before { with_current_tenant(organization) }

  describe 'DELETE /api/v1/vacancies/:id' do
    let!(:vacancy) { create(:vacancy, created_by: user.id) }

    it 'deletes a vacancy' do
      expect { delete "/api/v1/vacancies/#{vacancy.id}", headers: headers }
        .to change(Vacancy, :count).by(-1)

      expect(response).to have_http_status(:ok)
      expect(json_body['message']).to eq('Vacancy deleted')
    end

    it 'cascades deletion to associated vacancy skills' do
      vacancy.vacancy_skills.create!(skill_id: 'ruby', skill_label: 'Ruby', expected_level: 3)

      expect { delete "/api/v1/vacancies/#{vacancy.id}", headers: headers }
        .to change(VacancySkill, :count).by(-1)

      expect(Vacancy.exists?(vacancy.id)).to be(false)
    end

    it 'returns 404 for a nonexistent vacancy' do
      delete '/api/v1/vacancies/999999', headers: headers

      expect(response).to have_http_status(:not_found)
    end

    it 'requires an authenticated assessor' do
      delete "/api/v1/vacancies/#{vacancy.id}", headers: tenant_headers

      expect(response).to have_http_status(:unauthorized)
      expect(Vacancy.exists?(vacancy.id)).to be(true)
    end
  end
end
