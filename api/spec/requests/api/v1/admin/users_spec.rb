# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Admin Users API', type: :request do
  let!(:org) { create(:organization, scheme: 'client-corp', name: 'Client Corp') }
  let!(:super_admin) { create(:user, :admin, email: 'superadmin@rakamin.com', organization: nil) }
  let!(:assessor) { create(:user, :assessor, email: 'assessor@client.com', organization: org) }

  let(:admin_headers) { authenticated_headers(super_admin, scheme: 'public') }
  let(:assessor_headers) { authenticated_headers(assessor, scheme: org.scheme) }

  describe 'POST /api/v1/admin/users' do
    context 'when authenticated as super admin' do
      it 'creates another super admin successfully' do
        post '/api/v1/admin/users',
             params: {
               user: {
                 email: 'newadmin@rakamin.com',
                 password: 'password123',
                 role: 'admin'
               }
             }.to_json,
             headers: admin_headers

        expect(response).to have_http_status(:created)
        expect(json_body[:user]).to include(
          email: 'newadmin@rakamin.com',
          role: 'admin',
          organization_id: nil
        )

        created_user = User.find_by(email: 'newadmin@rakamin.com')
        expect(created_user).to be_present
        expect(created_user.role).to eq('admin')
        expect(created_user.authenticate('password123')).to be_truthy
      end

      it 'creates an assessor bound to an organization successfully' do
        post '/api/v1/admin/users',
             params: {
               user: {
                 email: 'newassessor@client.com',
                 password: 'password123',
                 role: 'assessor',
                 organization_id: org.id
               }
             }.to_json,
             headers: admin_headers

        expect(response).to have_http_status(:created)
        expect(json_body[:user]).to include(
          email: 'newassessor@client.com',
          role: 'assessor',
          organization_id: org.id,
          organization_name: 'Client Corp',
          organization_scheme: 'client-corp'
        )

        created_user = User.find_by(email: 'newassessor@client.com')
        expect(created_user).to be_present
        expect(created_user.role).to eq('assessor')
        expect(created_user.organization_id).to eq(org.id)
      end

      it 'rejects assessor creation if organization_id is missing' do
        post '/api/v1/admin/users',
             params: {
               user: {
                 email: 'noorg@client.com',
                 password: 'password123',
                 role: 'assessor'
               }
             }.to_json,
             headers: admin_headers

        expect(response).to have_http_status(:unprocessable_entity)
        expect(response.body).to include('Organization is required for assessors')
      end

      it 'rejects assessor creation if organization does not exist' do
        post '/api/v1/admin/users',
             params: {
               user: {
                 email: 'badorg@client.com',
                 password: 'password123',
                 role: 'assessor',
                 organization_id: 999_999
               }
             }.to_json,
             headers: admin_headers

        expect(response).to have_http_status(:unprocessable_entity)
        expect(response.body).to include('Organization not found')
      end

      it 'returns validation error for duplicate email' do
        post '/api/v1/admin/users',
             params: {
               user: {
                 email: super_admin.email,
                 password: 'password123',
                 role: 'admin'
               }
             }.to_json,
             headers: admin_headers

        expect(response).to have_http_status(:unprocessable_entity)
      end

      it 'returns validation error for invalid role' do
        post '/api/v1/admin/users',
             params: {
               user: {
                 email: 'hacker@test.com',
                 password: 'password123',
                 role: 'invalid_role'
               }
             }.to_json,
             headers: admin_headers

        expect(response).to have_http_status(:unprocessable_entity)
      end
    end

    context 'when authenticated as non-admin (assessor)' do
      it 'rejects with forbidden status' do
        post '/api/v1/admin/users',
             params: {
               user: {
                 email: 'unauthorized@test.com',
                 password: 'password123',
                 role: 'assessor',
                 organization_id: org.id
               }
             }.to_json,
             headers: assessor_headers

        expect(response).to have_http_status(:forbidden)
      end
    end

    context 'when unauthenticated' do
      it 'rejects with unauthorized status' do
        post '/api/v1/admin/users',
             params: {
               user: {
                 email: 'anon@test.com',
                 password: 'password123',
                 role: 'admin'
               }
             }.to_json,
             headers: { 'Content-Type' => 'application/json' }

        expect(response).to have_http_status(:unauthorized)
      end
    end
  end

  describe 'GET /api/v1/admin/users' do
    it 'lists users for super admin' do
      get '/api/v1/admin/users', headers: admin_headers

      expect(response).to have_http_status(:ok)
      expect(json_body[:users]).to be_an(Array)
      emails = json_body[:users].map { |u| u[:email] }
      expect(emails).to include(super_admin.email, assessor.email)
    end

    it 'rejects listing for non-admin' do
      get '/api/v1/admin/users', headers: assessor_headers

      expect(response).to have_http_status(:forbidden)
    end
  end
end
