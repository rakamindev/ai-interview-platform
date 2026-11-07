# frozen_string_literal: true

require 'rails_helper'
require 'sidekiq/api'

RSpec.describe 'Health endpoints', type: :request do
  let(:process_set) { instance_double(Sidekiq::ProcessSet, size: processes) }
  let(:processes) { 1 }
  let(:oldest_job_age) { 0 }
  let(:portfolio_queue) { instance_double(Sidekiq::Queue, name: 'portfolio', size: 2, latency: oldest_job_age) }

  before do
    allow(Sidekiq::ProcessSet).to receive(:new).and_return(process_set)
    allow(Sidekiq::Queue).to receive(:all).and_return([portfolio_queue])
  end

  def sidekiq_health
    get '/health/sidekiq'
    response.parsed_body
  end

  describe 'GET /health/sidekiq' do
    it 'reports healthy when a process is running and no job is waiting too long' do
      body = sidekiq_health

      expect(response).to have_http_status(:ok)
      expect(body).to include('status' => 'ok', 'reasons' => [], 'processes' => 1)
      expect(body.dig('queues', 'portfolio')).to eq('size' => 2, 'oldest_job_age_seconds' => 0)
    end

    context 'when no Sidekiq process is running (F-004)' do
      let(:processes) { 0 }

      it 'reports degraded with a failing status code, so a monitor can alert on it' do
        expect(sidekiq_health).to include('status' => 'degraded', 'reasons' => ['no_sidekiq_process'])
        expect(response).to have_http_status(:service_unavailable)
      end
    end

    context 'when a job waited longer than allowed, even with a process running' do
      let(:oldest_job_age) { Monitoring::SidekiqHealth::DEFAULT_MAX_JOB_WAIT + 1 }

      it 'reports degraded and shows the age of the oldest job' do
        body = sidekiq_health

        expect(body).to include('status' => 'degraded', 'reasons' => ['job_backlog'])
        expect(body.dig('queues', 'portfolio', 'oldest_job_age_seconds')).to eq(oldest_job_age)
        expect(response).to have_http_status(:service_unavailable)
      end
    end

    context 'when a job waited exactly the allowed time' do
      let(:oldest_job_age) { Monitoring::SidekiqHealth::DEFAULT_MAX_JOB_WAIT }

      it 'is still healthy' do
        expect(sidekiq_health['status']).to eq('ok')
      end
    end

    context 'when Sidekiq is down and jobs are piling up' do
      let(:processes) { 0 }
      let(:oldest_job_age) { Monitoring::SidekiqHealth::DEFAULT_MAX_JOB_WAIT + 1 }

      it 'reports both reasons' do
        expect(sidekiq_health['reasons']).to contain_exactly('no_sidekiq_process', 'job_backlog')
      end
    end

    context 'when Redis cannot be reached' do
      before { allow(Sidekiq::ProcessSet).to receive(:new).and_raise(RedisClient::CannotConnectError) }

      it 'answers instead of raising, because unknown must not look healthy' do
        expect(sidekiq_health).to include('status' => 'degraded', 'reasons' => ['redis_unavailable'])
        expect(response).to have_http_status(:service_unavailable)
      end

      it 'does not expose the error details on this public endpoint' do
        expect(response_body_after_request).not_to include('CannotConnect')
      end

      def response_body_after_request
        get '/health/sidekiq'
        response.body
      end
    end
  end

  describe 'GET /health (Kubernetes liveness and readiness probes)' do
    let(:processes) { 0 }

    it 'stays healthy when Sidekiq is down, so the API pod and its live interviews are not restarted' do
      get '/health'

      expect(response).to have_http_status(:ok)
      expect(JSON.parse(response.body)).to eq('status' => 'ok')
    end

    it 'does not touch Redis or Sidekiq' do
      get '/health'

      expect(Sidekiq::ProcessSet).not_to have_received(:new)
    end
  end
end
