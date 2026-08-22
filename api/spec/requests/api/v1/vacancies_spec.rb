# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Api::V1::Vacancies', type: :request do
  let(:user) { create(:user, :admin) }
  let(:headers) { auth_headers(user_id: user.id) }

  before { stub_tenant }

  describe 'GET /api/v1/vacancies' do
    before do
      create_list(:vacancy, 3, tenant_id: 1, created_by: user.id)
      get '/api/v1/vacancies', headers: headers
    end

    it 'returns HTTP 200 with vacancies list' do
      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)
      expect(json['vacancies'].length).to eq(3)
    end
  end

  describe 'POST /api/v1/vacancies' do
    context 'with valid params' do
      it 'returns HTTP 201' do
        post '/api/v1/vacancies',
             params: { vacancy: { role_title: 'Senior Engineer' } },
             headers: headers
        expect(response).to have_http_status(:created)
      end
    end

    context 'with missing role_title' do
      it 'returns HTTP 422' do
        post '/api/v1/vacancies',
             params: { vacancy: { role_title: '' } },
             headers: headers
        expect(response).to have_http_status(:unprocessable_entity)
      end
    end
  end

  describe 'DELETE /api/v1/vacancies/:id' do
    it 'returns HTTP 200' do
      vacancy = create(:vacancy, tenant_id: 1, created_by: user.id)
      delete "/api/v1/vacancies/#{vacancy.id}", headers: headers
      expect(response).to have_http_status(:ok)
    end
  end
end
