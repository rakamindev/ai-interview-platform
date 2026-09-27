# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Admin Organizations API', type: :request do
  let!(:org) { create(:organization, scheme: 'client-corp', name: 'Client Corp') }
  let!(:super_admin) { create(:user, :admin, email: 'superadmin@rakamin.com', organization: nil) }
  let!(:assessor) { create(:user, :assessor, email: 'assessor@client.com', organization: org) }

  let(:admin_headers) { authenticated_headers(super_admin, scheme: 'public') }
  let(:assessor_headers) { authenticated_headers(assessor, scheme: org.scheme) }

  describe 'GET /api/v1/admin/organizations' do
    context 'when authenticated as super admin' do
      it 'returns a list of all organizations' do
        get '/api/v1/admin/organizations', headers: admin_headers

        expect(response).to have_http_status(:ok)
        expect(json_body[:organizations]).to be_an(Array)
        schemes = json_body[:organizations].map { |o| o[:scheme] }
        expect(schemes).to include('client-corp')
      end
    end

    context 'when authenticated as non-admin (assessor)' do
      it 'rejects with forbidden status' do
        get '/api/v1/admin/organizations', headers: assessor_headers

        expect(response).to have_http_status(:forbidden)
      end
    end

    context 'when unauthenticated' do
      it 'rejects with unauthorized status' do
        get '/api/v1/admin/organizations'

        expect(response).to have_http_status(:unauthorized)
      end
    end
  end

  describe 'POST /api/v1/admin/organizations' do
    context 'when authenticated as super admin' do
      it 'creates a new organization with all required attributes' do
        post '/api/v1/admin/organizations',
             params: {
               organization: {
                 name: 'Tokopedia Talent',
                 scheme: 'tokopedia',
                 identifier: 'tokopedia',
                 host: 'tokopedia.com'
               }
             }.to_json,
             headers: admin_headers

        expect(response).to have_http_status(:created)
        expect(json_body[:organization]).to include(
          name: 'Tokopedia Talent',
          scheme: 'tokopedia',
          identifier: 'tokopedia',
          host: 'tokopedia.com'
        )

        created_org = Organization.find_by(scheme: 'tokopedia')
        expect(created_org).to be_present
        expect(created_org.name).to eq('Tokopedia Talent')
      end

      it 'auto-derives identifier and host if omitted' do
        post '/api/v1/admin/organizations',
             params: {
               organization: {
                 name: 'Gojek Tech',
                 scheme: 'gojek-tech'
               }
             }.to_json,
             headers: admin_headers

        expect(response).to have_http_status(:created)
        expect(json_body[:organization][:scheme]).to eq('gojek-tech')
        expect(json_body[:organization][:identifier]).to eq('gojek-tech')
        expect(json_body[:organization][:host]).to be_present
      end

      it 'rejects organization creation if name is missing' do
        post '/api/v1/admin/organizations',
             params: {
               organization: {
                 scheme: 'noname'
               }
             }.to_json,
             headers: admin_headers

        expect(response).to have_http_status(:unprocessable_entity)
      end

      it 'rejects organization creation if scheme is duplicate' do
        post '/api/v1/admin/organizations',
             params: {
               organization: {
                 name: 'Duplicate Corp',
                 scheme: org.scheme
               }
             }.to_json,
             headers: admin_headers

        expect(response).to have_http_status(:unprocessable_entity)
      end

      it 'rejects invalid scheme formats (spaces, special chars)' do
        post '/api/v1/admin/organizations',
             params: {
               organization: {
                 name: 'Bad Scheme Corp',
                 scheme: 'bad scheme with spaces!'
               }
             }.to_json,
             headers: admin_headers

        expect(response).to have_http_status(:unprocessable_entity)
      end
    end

    context 'when authenticated as non-admin (assessor)' do
      it 'rejects with forbidden status' do
        post '/api/v1/admin/organizations',
             params: {
               organization: {
                 name: 'Hacker Corp',
                 scheme: 'hacker-corp'
               }
             }.to_json,
             headers: assessor_headers

        expect(response).to have_http_status(:forbidden)
      end
    end

    context 'when unauthenticated' do
      it 'rejects with unauthorized status' do
        post '/api/v1/admin/organizations',
             params: {
               organization: {
                 name: 'Anon Corp',
                 scheme: 'anon-corp'
               }
             }.to_json,
             headers: { 'Content-Type' => 'application/json' }

        expect(response).to have_http_status(:unauthorized)
      end
    end
  end
end
