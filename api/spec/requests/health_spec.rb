# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Health endpoints', type: :request do
  it 'reports ready when DB and Redis respond' do
    get '/health/ready'
    expect(response).to have_http_status(:ok)
    expect(JSON.parse(response.body)).to eq('status' => 'ready')
  end

  it 'reports unavailable (503) when Redis is down' do
    allow(Sidekiq).to receive(:redis).and_raise(Redis::CannotConnectError, 'down')
    get '/health/ready'
    expect(response).to have_http_status(:service_unavailable)
    expect(JSON.parse(response.body)).to eq('status' => 'unavailable', 'error' => 'Redis::CannotConnectError')
  end

  it 'keeps liveness static and tenant-free' do
    get '/health'
    expect(response).to have_http_status(:ok)
    expect(JSON.parse(response.body)).to eq('status' => 'ok')
  end
end
