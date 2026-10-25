# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Organization Members API', type: :request do
  let!(:org) { Organization.create!(name: 'Cyber Corp', scheme: 'cyber-corp', identifier: 'cyber-corp', host: 'localhost') }
  let!(:other_org) { Organization.create!(name: 'Other Corp', scheme: 'other-corp', identifier: 'other-corp', host: 'localhost') }

  let!(:admin_user) { User.create!(email: 'admin@cyber.com', password: 'password123', role: 'admin') }
  let!(:assessor_user) { User.create!(email: 'assessor@cyber.com', password: 'password123', role: 'user') }

  let!(:admin_membership) { OrganizationMembership.create!(user: admin_user, organization: org, role: 'admin') }
  let!(:assessor_membership) { OrganizationMembership.create!(user: assessor_user, organization: org, role: 'assessor') }

  let(:admin_token) { JsonWebToken.encode({ user_id: admin_user.id, role: 'admin', scheme: org.scheme }) }
  let(:assessor_token) { JsonWebToken.encode({ user_id: assessor_user.id, role: 'assessor', scheme: org.scheme }) }

  let(:admin_headers) do
    {
      'Authorization' => "Bearer #{admin_token}",
      'X-Tenant-Scheme' => org.scheme,
      'Content-Type' => 'application/json'
    }
  end

  let(:assessor_headers) do
    {
      'Authorization' => "Bearer #{assessor_token}",
      'X-Tenant-Scheme' => org.scheme,
      'Content-Type' => 'application/json'
    }
  end

  describe 'GET /api/v1/organization/members' do
    it 'returns list of members in current organization' do
      get '/api/v1/organization/members', headers: admin_headers

      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)
      expect(json['members']).to be_an(Array)
      expect(json['members'].length).to eq(2)
      expect(json['members'].map { |m| m['email'] }).to contain_exactly('admin@cyber.com', 'assessor@cyber.com')
    end
  end

  describe 'POST /api/v1/organization/members/invite' do
    it 'allows admin to invite a colleague to the organization' do
      post '/api/v1/organization/members/invite',
           params: { email: 'new.member@cyber.com', role: 'assessor' }.to_json,
           headers: admin_headers

      expect(response).to have_http_status(:created)
      json = JSON.parse(response.body)
      expect(json['member']['email']).to eq('new.member@cyber.com')
      expect(json['member']['role']).to eq('assessor')

      # Check membership created
      new_user = User.find_by(email: 'new.member@cyber.com')
      expect(new_user).to be_present
      expect(new_user.member_of?(org)).to be true
    end

    it 'rejects invitation if user is already a member of the organization' do
      post '/api/v1/organization/members/invite',
           params: { email: 'assessor@cyber.com', role: 'assessor' }.to_json,
           headers: admin_headers

      expect(response).to have_http_status(:unprocessable_entity)
      json = JSON.parse(response.body)
      expect(json['error']).to eq('User is already a member of this organization')
    end

    it 'rejects invite attempts from non-admin assessors with 403 forbidden' do
      post '/api/v1/organization/members/invite',
           params: { email: 'sneaky@cyber.com', role: 'assessor' }.to_json,
           headers: assessor_headers

      expect(response).to have_http_status(:forbidden)
    end
  end

  describe 'DELETE /api/v1/organization/members/:id' do
    it 'allows admin to remove a member from the organization' do
      delete "/api/v1/organization/members/#{assessor_membership.id}", headers: admin_headers

      expect(response).to have_http_status(:ok)
      expect(OrganizationMembership.exists?(id: assessor_membership.id)).to be false
    end

    it 'prevents admin from removing themselves from the organization' do
      delete "/api/v1/organization/members/#{admin_membership.id}", headers: admin_headers

      expect(response).to have_http_status(:unprocessable_entity)
      json = JSON.parse(response.body)
      expect(json['error']).to eq('You cannot remove yourself from the organization')
    end

    it 'returns 404 if member belongs to a different organization' do
      other_user = User.create!(email: 'other@other.com', password: 'password123', role: 'user')
      other_membership = OrganizationMembership.create!(user: other_user, organization: other_org, role: 'assessor')

      delete "/api/v1/organization/members/#{other_membership.id}", headers: admin_headers

      expect(response).to have_http_status(:not_found)
    end
  end
end
