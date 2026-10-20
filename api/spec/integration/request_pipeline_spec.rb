# frozen_string_literal: true

require 'rails_helper'

# The Rack stack in front of every controller, run for real: CORS, rate limiting,
# the WebSocket middlewares, tenant resolution and auth, then the controller.
RSpec.describe 'Request pipeline', type: :request do
  let!(:company_a) { create(:organization) }
  let!(:company_b) { create(:organization) }

  describe 'tenant resolution' do
    let!(:assessment_a) { create(:assessment, organization: company_a, name: 'A role') }
    let!(:assessment_b) { create(:assessment, organization: company_b, name: 'B role') }

    it "scopes a request to the organization named in the caller's token" do
      get '/api/v1/assessments', headers: auth_headers_for(company_b)

      expect(response.parsed_body['assessments'].pluck('name')).to eq(['B role'])
    end

    it 'lets a signed token decide the tenant, not an X-Tenant-Scheme header' do
      get '/api/v1/assessments', headers: auth_headers_for(company_a).merge('X-Tenant-Scheme' => company_b.scheme)

      expect(response.parsed_body['assessments'].pluck('name')).to eq(['A role'])
    end

    it 'does not carry one request’s tenant into the next' do
      get '/api/v1/assessments', headers: auth_headers_for(company_a)
      get '/api/v1/assessments', headers: { 'Content-Type' => 'application/json' }

      expect(response).to have_http_status(:forbidden)
      expect(RequestStore.store[:tenant_id]).to be_nil
    end

    it 'serves the candidate page by invite token with no tenant or token at all' do
      session = create(:session, assessment: assessment_b)

      get "/api/v1/sessions/#{session.invite_token}/candidate"

      expect(response).to have_http_status(:ok)
      expect(response.parsed_body['role_title']).to eq('B role')
    end
  end

  describe 'CORS' do
    it 'answers the browser preflight for the web app with the headers it needs' do
      options '/api/v1/assessments', headers: {
        'Origin' => 'http://localhost:5173',
        'Access-Control-Request-Method' => 'GET',
        'Access-Control-Request-Headers' => 'authorization,content-type'
      }

      expect(response.headers['Access-Control-Allow-Origin']).to be_present
      expect(response.headers['Access-Control-Allow-Methods']).to include('GET')
      expect(response.headers['Access-Control-Allow-Headers'].downcase).to include('authorization')
    end
  end

  describe 'WebSocket paths' do
    it 'passes a plain HTTP request to a WebSocket path on to the app instead of hijacking it' do
      # Reaching the Rails router (which has no such route) proves the middleware let it through.
      expect { get '/ws/sessions/1/coverage' }.to raise_error(ActionController::RoutingError)
    end
  end

  describe 'rate limiting', :rack_attack do
    around do |example|
      store = Rack::Attack.cache.store
      Rack::Attack.cache.store = ActiveSupport::Cache::MemoryStore.new
      Rack::Attack.enabled = true
      # The throttles count per clock minute; on a slow run the requests could straddle two and never reach the limit.
      freeze_time { example.run }
    ensure
      Rack::Attack.enabled = false
      Rack::Attack.cache.store = store
    end

    it 'blocks the sixth login attempt in a minute from one address, with a JSON 429' do
      6.times do
        post '/api/v1/auth/login', params: { email: 'x@example.test', password: 'guess' }.to_json,
                                   headers: { 'Content-Type' => 'application/json', 'REMOTE_ADDR' => '203.0.113.7' }
      end

      expect(response).to have_http_status(:too_many_requests)
      expect(response.parsed_body).to eq('error' => 'Too many requests. Please try again later.')
    end

    it 'counts each address separately' do
      5.times do
        post '/api/v1/auth/login', params: {}.to_json, headers: { 'Content-Type' => 'application/json', 'REMOTE_ADDR' => '203.0.113.7' }
      end
      post '/api/v1/auth/login', params: {}.to_json, headers: { 'Content-Type' => 'application/json', 'REMOTE_ADDR' => '203.0.113.8' }

      expect(response).not_to have_http_status(:too_many_requests)
    end

    it 'limits invite-link lookups to 30 a minute per address' do
      31.times { get '/api/v1/sessions/not-a-token/candidate', headers: { 'REMOTE_ADDR' => '203.0.113.9' } }

      expect(response).to have_http_status(:too_many_requests)
    end
  end
end
