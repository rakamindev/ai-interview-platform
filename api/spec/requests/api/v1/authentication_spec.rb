# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Authentication API', type: :request do
  let!(:existing_admin) do
    User.create!(
      email: 'existing.admin@example.com',
      password: 'password123',
      role: 'admin'
    )
  end

  let!(:existing_user) do
    User.create!(
      email: 'standard.user@example.com',
      password: 'password123',
      role: 'user'
    )
  end

  describe 'POST /api/v1/auth/signup' do
    it 'creates a new admin user by default and returns 201 with JWT token' do
      post '/api/v1/auth/signup', params: {
        email: 'new.recruiter@example.com',
        password: 'securepassword123'
      }

      expect(response).to have_http_status(:created)
      body = JSON.parse(response.body)
      expect(body['token']).to be_present
      expect(body['user']['email']).to eq('new.recruiter@example.com')
      expect(body['user']['role']).to eq('admin')

      created_user = User.find_by(email: 'new.recruiter@example.com')
      expect(created_user).to be_present
      expect(created_user.role).to eq('admin')
    end

    it 'creates a user with explicit role when provided' do
      post '/api/v1/auth/signup', params: {
        email: 'another.admin@example.com',
        password: 'securepassword123',
        role: 'admin'
      }

      expect(response).to have_http_status(:created)
      body = JSON.parse(response.body)
      expect(body['user']['role']).to eq('admin')
    end

    it 'works via alias route POST /api/v1/signup' do
      post '/api/v1/signup', params: {
        email: 'alias.user@example.com',
        password: 'securepassword123'
      }

      expect(response).to have_http_status(:created)
      body = JSON.parse(response.body)
      expect(body['token']).to be_present
    end

    it 'returns 422 if email is missing or invalid' do
      post '/api/v1/auth/signup', params: {
        email: 'not-an-email',
        password: 'securepassword123'
      }

      expect(response).to have_http_status(:unprocessable_entity)
      body = JSON.parse(response.body)
      expect(body['errors'][0]['message']).to include('Email is invalid')
    end

    it 'returns 422 if email is already taken' do
      post '/api/v1/auth/signup', params: {
        email: 'existing.admin@example.com',
        password: 'newpassword123'
      }

      expect(response).to have_http_status(:unprocessable_entity)
      body = JSON.parse(response.body)
      expect(body['errors'][0]['message']).to include('Email has already been taken')
    end

    it 'returns 422 if password is blank' do
      post '/api/v1/auth/signup', params: {
        email: 'fresh@example.com',
        password: ''
      }

      expect(response).to have_http_status(:unprocessable_entity)
      body = JSON.parse(response.body)
      expect(body['errors'][0]['message']).to include("Password can't be blank")
    end

    it 'returns 422 if password is shorter than 6 characters' do
      post '/api/v1/auth/signup', params: {
        email: 'fresh@example.com',
        password: '12345'
      }

      expect(response).to have_http_status(:unprocessable_entity)
      body = JSON.parse(response.body)
      expect(body['errors'][0]['message']).to include('Password is too short (minimum is 6 characters)')
    end

    it 'returns 422 if role is invalid' do
      post '/api/v1/auth/signup', params: {
        email: 'fresh@example.com',
        password: 'password123',
        role: 'superadmin'
      }

      expect(response).to have_http_status(:unprocessable_entity)
      body = JSON.parse(response.body)
      expect(body['errors'][0]['message']).to include('Role is not included in the list')
    end
  end

  describe 'POST /api/v1/auth/login' do
    it 'authenticates admin user and returns 200 with JWT token' do
      post '/api/v1/auth/login', params: {
        email: 'existing.admin@example.com',
        password: 'password123'
      }

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body['token']).to be_present
      expect(body['user']['email']).to eq('existing.admin@example.com')
      expect(body['user']['role']).to eq('admin')
    end

    it 'rejects wrong password with 401' do
      post '/api/v1/auth/login', params: {
        email: 'existing.admin@example.com',
        password: 'wrongpassword'
      }

      expect(response).to have_http_status(:unauthorized)
      body = JSON.parse(response.body)
      expect(body['errors'][0]['message']).to eq('Invalid email or password')
    end

    it 'rejects non-existent email with 401' do
      post '/api/v1/auth/login', params: {
        email: 'nobody@example.com',
        password: 'password123'
      }

      expect(response).to have_http_status(:unauthorized)
    end

    it 'rejects non-admin role user with 401' do
      post '/api/v1/auth/login', params: {
        email: 'standard.user@example.com',
        password: 'password123'
      }

      expect(response).to have_http_status(:unauthorized)
      body = JSON.parse(response.body)
      expect(body['errors'][0]['message']).to eq('Invalid email or password')
    end
  end
end
