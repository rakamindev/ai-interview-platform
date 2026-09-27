# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Vacancies API', type: :request do
  let!(:org_a) { create(:organization, name: 'Acme Corp', scheme: 'acme') }
  let!(:org_b) { create(:organization, name: 'Beta Ltd', scheme: 'beta') }

  let!(:admin) { create(:user, :admin) }
  let!(:assessor_a) { create(:user, :assessor, organization: org_a) }

  let!(:vacancy_a) { create(:vacancy, tenant_id: org_a.id, created_by: assessor_a.id, role_title: 'Acme Engineer') }
  let!(:vacancy_b) { create(:vacancy, tenant_id: org_b.id, created_by: admin.id, role_title: 'Beta Designer') }

  let(:admin_headers) { authenticated_headers(admin, scheme: org_a.scheme) }
  let(:assessor_headers) { authenticated_headers(assessor_a, scheme: org_a.scheme) }

  describe 'GET /api/v1/vacancies' do
    context 'as a Super Admin' do
      it 'returns vacancies across all client tenants' do
        get '/api/v1/vacancies', headers: admin_headers

        expect(response).to have_http_status(:ok)
        titles = json_body[:vacancies].map { |v| v[:role_title] }
        expect(titles).to include('Acme Engineer', 'Beta Designer')
      end

      it 'includes organization details in the serialization' do
        get '/api/v1/vacancies', headers: admin_headers

        expect(response).to have_http_status(:ok)
        v_a = json_body[:vacancies].find { |v| v[:id] == vacancy_a.id }
        expect(v_a[:tenant_id]).to eq(org_a.id)
        expect(v_a[:organization_name]).to eq('Acme Corp')
        expect(v_a[:organization_scheme]).to eq('acme')
      end

      it 'filters by organization_id parameter when provided' do
        get '/api/v1/vacancies', params: { organization_id: org_b.id }, headers: admin_headers

        expect(response).to have_http_status(:ok)
        titles = json_body[:vacancies].map { |v| v[:role_title] }
        expect(titles).to include('Beta Designer')
        expect(titles).not_to include('Acme Engineer')
      end
    end

    context 'as a Tenant Assessor' do
      it 'returns only vacancies scoped to their organization' do
        get '/api/v1/vacancies', headers: assessor_headers

        expect(response).to have_http_status(:ok)
        titles = json_body[:vacancies].map { |v| v[:role_title] }
        expect(titles).to include('Acme Engineer')
        expect(titles).not_to include('Beta Designer')
      end
    end
  end

  describe 'POST /api/v1/vacancies' do
    let(:valid_vacancy_params) do
      {
        vacancy: {
          role_title: 'Full Stack Engineer',
          culture_dimensions: 'Async first',
          competency_expectations: 'Solid communicator'
        }
      }
    end

    context 'as a Super Admin' do
      it 'assigns the specified organization_id to the created vacancy' do
        params = valid_vacancy_params.deep_merge(vacancy: { organization_id: org_b.id })

        post '/api/v1/vacancies', params: params.to_json, headers: admin_headers

        expect(response).to have_http_status(:created)
        vacancy_json = json_body[:vacancy]
        expect(vacancy_json[:tenant_id]).to eq(org_b.id)
        expect(vacancy_json[:organization_name]).to eq('Beta Ltd')

        created_vacancy = Vacancy.find(vacancy_json[:id])
        expect(created_vacancy.tenant_id).to eq(org_b.id)
      end
    end

    context 'as a Tenant Assessor' do
      it 'ignores any passed organization_id and enforces Current.tenant_id' do
        params = valid_vacancy_params.deep_merge(vacancy: { organization_id: org_b.id })

        post '/api/v1/vacancies', params: params.to_json, headers: assessor_headers

        expect(response).to have_http_status(:created)
        vacancy_json = json_body[:vacancy]
        expect(vacancy_json[:tenant_id]).to eq(org_a.id)

        created_vacancy = Vacancy.find(vacancy_json[:id])
        expect(created_vacancy.tenant_id).to eq(org_a.id)
      end
    end
  end
end
