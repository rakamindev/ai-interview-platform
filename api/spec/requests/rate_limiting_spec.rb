# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Rack::Attack Rate Limiting', type: :request do
  before do
    Rack::Attack.enabled = true
    Rack::Attack.reset!
  end

  after do
    Rack::Attack.reset!
    Rack::Attack.enabled = false
  end

  it 'throttles auth/login after 5 attempts per minute' do
    5.times do
      post '/api/v1/auth/login', params: { email: 'test@example.com', password: 'wrong' }
    end

    post '/api/v1/auth/login', params: { email: 'test@example.com', password: 'wrong' }
    expect(response).to have_http_status(:too_many_requests)
    json = JSON.parse(response.body)
    expect(json['error']).to include('Too many requests')
  end
end
