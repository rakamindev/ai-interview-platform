# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Authentication API', type: :request do
  describe 'POST /api/v1/auth/signup/organization' do
    let(:valid_params) do
      {
        organization_name: 'Acme Technologies',
        email: 'founder@acme.com',
        password: 'secure_password_123'
      }
    end

    it 'creates a new organization, admin user, and admin membership' do
      post '/api/v1/auth/signup/organization', params: valid_params, as: :json

      expect(response).to have_http_status(:created)
      json = JSON.parse(response.body)
      expect(json['token']).to be_present
      expect(json['user']['email']).to eq('founder@acme.com')
      expect(json['user']['role']).to eq('admin')
      expect(json['active_organization']['name']).to eq('Acme Technologies')
      expect(json['active_organization']['scheme']).to eq('acme-technologies')
      expect(json['organizations'].length).to eq(1)

      # Verify database entities created
      user = User.find_by(email: 'founder@acme.com')
      expect(user).to be_present
      expect(user.organizations.first.name).to eq('Acme Technologies')
      expect(user.role_in(user.organizations.first)).to eq('admin')
    end

    it 'rejects registration when email is already taken' do
      User.create!(email: 'founder@acme.com', password: 'existing_password', role: 'admin')

      post '/api/v1/auth/signup/organization', params: valid_params, as: :json

      expect(response).to have_http_status(:unprocessable_entity)
      json = JSON.parse(response.body)
      expect(json['error']).to eq('Email has already been taken')
    end
  end

  describe 'POST /api/v1/auth/signup/user' do
    it 'creates standalone user with 0 memberships' do
      post '/api/v1/auth/signup/user',
           params: { email: 'freelance.assessor@example.com', password: 'password123' },
           as: :json

      expect(response).to have_http_status(:created)
      json = JSON.parse(response.body)
      expect(json['token']).to be_present
      expect(json['user']['email']).to eq('freelance.assessor@example.com')
      expect(json['active_organization']).to be_nil
      expect(json['organizations']).to eq([])

      user = User.find_by(email: 'freelance.assessor@example.com')
      expect(user.organizations).to be_empty
    end
  end

  describe 'POST /api/v1/auth/login' do
    let!(:user) { User.create!(email: 'staff@example.com', password: 'password123', role: 'user') }
    let!(:org_alpha) { Organization.create!(name: 'Alpha Corp', scheme: 'alpha-corp', identifier: 'alpha-corp', host: 'localhost') }
    let!(:org_beta) { Organization.create!(name: 'Beta Corp', scheme: 'beta-corp', identifier: 'beta-corp', host: 'localhost') }

    before do
      OrganizationMembership.create!(user: user, organization: org_alpha, role: 'admin')
      OrganizationMembership.create!(user: user, organization: org_beta, role: 'assessor')
    end

    it 'authenticates credentials and returns list of accessible organizations' do
      post '/api/v1/auth/login', params: { email: 'staff@example.com', password: 'password123' }, as: :json

      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)
      expect(json['token']).to be_present
      expect(json['active_organization']['scheme']).to eq('alpha-corp')
      expect(json['organizations'].length).to eq(2)
      expect(json['organizations'].map { |o| o['scheme'] }).to contain_exactly('alpha-corp', 'beta-corp')
    end

    it 'rejects invalid credentials with 401 unauthorized' do
      post '/api/v1/auth/login', params: { email: 'staff@example.com', password: 'wrongpassword' }, as: :json

      expect(response).to have_http_status(:unauthorized)
      json = JSON.parse(response.body)
      expect(json['error']).to eq('Invalid email or password')
    end
  end

  describe 'POST /api/v1/auth/switch_tenant' do
    let!(:user) { User.create!(email: 'recruiter@global.com', password: 'password123', role: 'user') }
    let!(:org1) { Organization.create!(name: 'First Org', scheme: 'first-org', identifier: 'first-org', host: 'localhost') }
    let!(:org2) { Organization.create!(name: 'Second Org', scheme: 'second-org', identifier: 'second-org', host: 'localhost') }
    let!(:org_unauthorized) { Organization.create!(name: 'Private Org', scheme: 'private-org', identifier: 'private-org', host: 'localhost') }

    let!(:token) { JsonWebToken.encode({ user_id: user.id, role: 'admin', scheme: org1.scheme }) }

    before do
      OrganizationMembership.create!(user: user, organization: org1, role: 'admin')
      OrganizationMembership.create!(user: user, organization: org2, role: 'assessor')
    end

    it 'switches active tenant and issues new JWT with target organization scheme' do
      post '/api/v1/auth/switch_tenant',
           params: { organization_id: org2.id },
           headers: { 'Authorization' => "Bearer #{token}" },
           as: :json

      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)
      expect(json['token']).to be_present
      expect(json['active_organization']['scheme']).to eq('second-org')
      expect(json['role']).to eq('assessor')

      # Decoded token verifies new scheme and role
      decoded = JsonWebToken.decode(json['token'])
      expect(decoded[:scheme]).to eq('second-org')
      expect(decoded[:role]).to eq('assessor')
    end

    it 'rejects switching to an organization where user has no membership with 403' do
      post '/api/v1/auth/switch_tenant',
           params: { organization_id: org_unauthorized.id },
           headers: { 'Authorization' => "Bearer #{token}" },
           as: :json

      expect(response).to have_http_status(:forbidden)
      json = JSON.parse(response.body)
      expect(json['error']).to eq('You are not a member of this organization')
    end
  end
end
