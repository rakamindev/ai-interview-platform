# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'GET /api/v1/health/ready', type: :request do
  before do
    allow(ActiveRecord::Base.connection).to receive(:select_value).with('SELECT 1').and_return(1)
    allow(Sidekiq).to receive(:redis).and_yield(double('RedisClient', ping: 'PONG'))
    allow(EventMachine).to receive(:reactor_running?).and_return(true)
  end

  context 'when all dependencies are healthy' do
    it 'returns ok' do
      get '/api/v1/health/ready'

      expect(response).to have_http_status(:ok)
      expect(JSON.parse(response.body)['checks']).to eq(
        'database' => true, 'redis' => true, 'eventmachine' => true
      )
    end
  end

  context 'when Redis is down' do
    before do
      allow(Sidekiq).to receive(:redis).and_raise(Redis::CannotConnectError)
    end

    it 'returns 503 with the failing check' do
      get '/api/v1/health/ready'

      expect(response).to have_http_status(:service_unavailable)
      expect(JSON.parse(response.body)['checks']['redis']).to be(false)
    end
  end

  context 'when the EventMachine reactor has died (all WS dead)' do
    before do
      allow(EventMachine).to receive(:reactor_running?).and_return(false)
    end

    it 'reports degraded so k8s pulls the pod from rotation' do
      get '/api/v1/health/ready'

      expect(response).to have_http_status(:service_unavailable)
      expect(JSON.parse(response.body)['checks']['eventmachine']).to be(false)
    end
  end
end
