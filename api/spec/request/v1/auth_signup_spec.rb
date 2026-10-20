# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'POST /api/v1/auth/signup', type: :request do
  let(:path)     { '/api/v1/auth/signup' }
  let(:email)    { 'new.admin@example.com' }
  let(:password) { 'secret1234' }

  def signup(email: self.email, password: self.password, **extra)
    post path, params: { email:, password:, **extra }, as: :json
  end

  def json
    JSON.parse(response.body)
  end

  it 'creates an admin account and returns 201 without a token' do
    expect { signup }.to change(User, :count).by(1)

    expect(response).to have_http_status(:created)
    expect(json['user']).to include('email' => email, 'role' => 'admin')
    expect(json).not_to have_key('token')
  end
  
  it 'ignores a role sent by the client and always creates an admin' do
  signup(role: 'user')

  expect(User.find_by!(email:).role).to eq('admin')
  end
  

  it 'stores the password as a bcrypt hash, never as plain text' do
    signup

    stored = User.find_by!(email:).password_digest
    expect(stored).not_to eq(password)
    expect(stored).to match(/\A\$2[aby]\$/)
  end

  it 'never exposes the password or its digest in the response' do
    signup

    expect(response.body).not_to include(password)
    expect(response.body).not_to include('password_digest')
  end

  it 'rejects a duplicate email with a clear message' do
    signup
    expect { signup }.not_to change(User, :count)

    expect(response).to have_http_status(:unprocessable_entity)
    expect(json['errors'][0]['message']).to match(/Email is already registered/i)
  end


  it 'rejects a missing password' do
    signup(password: nil)

    expect(response).to have_http_status(:unprocessable_entity)
    expect(json['errors'][0]['message']).to match(/password/i)
  end
end
