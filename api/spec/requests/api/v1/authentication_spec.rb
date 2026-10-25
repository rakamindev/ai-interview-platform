require 'rails_helper'

RSpec.describe 'Api::V1::Authentication', type: :request do
  let!(:admin) { create(:user, :admin, password: 'password123') }
  let!(:user) { create(:user, role: 'user', password: 'password123') }
  let(:headers) do
    { 'X-Tenant-Scheme' => 'test-corp', 'Content-Type' => 'application/json' }
  end

  describe 'POST /api/v1/auth/login' do
    let(:valid_credentials) do
      { email: admin.email, password: 'password123' }
    end

    context 'Positive Cases' do
      it 'authenticates an admin user successfully' do
        post '/api/v1/auth/login', params: valid_credentials.to_json, headers: headers

        expect(response).to have_http_status(:success)
        json = JSON.parse(response.body)
        expect(json['token']).to be_present
        expect(json['user']['id']).to eq(admin.id)
        expect(json['user']['role']).to eq('admin')
      end
    end

    context 'Negative Cases' do
      it 'rejects login without an email' do
        post '/api/v1/auth/login', params: { password: 'password123' }.to_json, headers: headers
        expect(response).to have_http_status(:unauthorized)
        json = JSON.parse(response.body)
        expect(json['errors'][0]['message']).to eq('Invalid email or password')
      end

      it 'rejects login when password does not match' do
        post '/api/v1/auth/login', params: { email: admin.email, password: 'wrong' }.to_json, headers: headers
        expect(response).to have_http_status(:unauthorized)
      end

      it 'rejects login if the user role is not admin' do
        post '/api/v1/auth/login', params: { email: user.email, password: 'password123' }.to_json, headers: headers
        expect(response).to have_http_status(:unauthorized)
      end
    end
  end
end
