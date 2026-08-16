# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Api::V1::AuthenticationController, type: :request do # rubocop:disable Metrics/BlockLength
  describe 'POST /api/v1/auth/signup' do
    it 'creates an assessor account and returns a success message' do
      expect do
        post '/api/v1/auth/signup', params: { email: 'candidate@example.com', password: 'secret123' }
      end.to change(User, :count).by(1)

      expect(response).to have_http_status(:created)
      expect(response.parsed_body['message']).to include('Account created')
      expect(User.last.role).to eq('assessor')
      expect(response.parsed_body).not_to have_key('token')
    end

    it 'never honors a client-supplied admin role' do
      post '/api/v1/auth/signup',
           params: { email: 'candidate@example.com', password: 'secret123', role: 'admin' }

      expect(User.last.role).to eq('assessor')
    end

    it 'rejects a duplicate email' do
      create(:user, email: 'candidate@example.com')

      post '/api/v1/auth/signup', params: { email: 'candidate@example.com', password: 'secret123' }

      expect(response).to have_http_status(:unprocessable_entity)
    end

    it 'rejects an invalid email' do
      post '/api/v1/auth/signup', params: { email: 'not-an-email', password: 'secret123' }

      expect(response).to have_http_status(:unprocessable_entity)
    end
  end

  describe 'POST /api/v1/auth/login' do # rubocop:disable Metrics/BlockLength
    it 'signs in an assessor account' do
      create(:user, email: 'assessor@example.com', password: 'secret123', role: 'assessor')

      post '/api/v1/auth/login', params: { email: 'assessor@example.com', password: 'secret123' }

      expect(response).to have_http_status(:ok)
      expect(response.parsed_body['token']).to be_present
      expect(response.parsed_body['user']['role']).to eq('assessor')
    end

    it 'signs in an admin account' do
      create(:user, email: 'admin@example.com', password: 'secret123', role: 'admin')

      post '/api/v1/auth/login', params: { email: 'admin@example.com', password: 'secret123' }

      expect(response).to have_http_status(:ok)
      expect(response.parsed_body['user']['role']).to eq('admin')
    end

    it 'rejects a plain user account' do
      create(:user, email: 'user@example.com', password: 'secret123', role: 'user')

      post '/api/v1/auth/login', params: { email: 'user@example.com', password: 'secret123' }

      expect(response).to have_http_status(:unauthorized)
    end

    it 'rejects a wrong password' do
      create(:user, email: 'assessor@example.com', password: 'secret123', role: 'assessor')

      post '/api/v1/auth/login', params: { email: 'assessor@example.com', password: 'wrongpass' }

      expect(response).to have_http_status(:unauthorized)
    end

    it 'is case-insensitive on email' do
      create(:user, email: 'Assessor@Example.com', password: 'secret123', role: 'assessor')

      post '/api/v1/auth/login', params: { email: 'assessor@example.com', password: 'secret123' }

      expect(response).to have_http_status(:ok)
    end
  end
end
