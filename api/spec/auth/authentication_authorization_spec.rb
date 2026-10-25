# frozen_string_literal: true

require 'action_dispatch'
require 'rack/mock'
require 'request_store'

require_relative '../spec_helper'
require_relative '../../app/controllers/concerns/exception_handler'
require_relative '../../app/lib/message'
require_relative '../../app/models/current'
require_relative '../../app/lib/json_web_token'
require_relative '../../app/auth/authorize_api_request'
require_relative '../../app/middlewares/application_middleware'
require_relative '../../app/middlewares/auth_token_middleware'
require_relative '../../app/middlewares/tenant_resolver_middleware'

RSpec.describe 'Authentication and authorization' do
  let(:app) { ->(_env) { [200, { 'Content-Type' => 'application/json' }, ['ok']] } }

  around do |example|
    previous_secret = ENV['SECRET_KEY_BASE']
    ENV['SECRET_KEY_BASE'] = 'test-secret-key'
    example.run
  ensure
    ENV['SECRET_KEY_BASE'] = previous_secret
    Current.clear
  end

  def token_for(role: 'admin', scheme: 'test-corp', exp: 1.hour.from_now.to_i)
    JsonWebToken.encode(user_id: 42, role:, scheme:, exp:)
  end

  def request_env(token = nil)
    headers = token ? { 'HTTP_AUTHORIZATION' => "Bearer #{token}" } : {}
    Rack::MockRequest.env_for('/api/v1/assessments', headers)
  end

  it 'authenticates a valid admin token' do
    result = AuthorizeApiRequest.new(
      { 'Authorization' => "Bearer #{token_for}" },
      [:admin]
    ).call

    expect(result[:user].id).to eq(42)
    expect(result[:user].role).to eq('admin')
    expect(result[:user].scheme).to eq('test-corp')
  end

  it 'returns HTTP 401 for a missing or invalid token' do
    middleware = AuthTokenMiddleware.new(app, :admin)

    expect(middleware.call(request_env).first).to eq(401)
    expect(middleware.call(request_env('not-a-token')).first).to eq(401)
  end

  it 'returns HTTP 401 for an expired token' do
    expired_token = token_for(exp: 1.minute.ago.to_i)
    response = AuthTokenMiddleware.new(app, :admin).call(request_env(expired_token))

    expect(response.first).to eq(401)
  end

  it 'returns HTTP 403 when an authenticated user lacks the required role' do
    user_token = token_for(role: 'user')
    response = AuthTokenMiddleware.new(app, :admin).call(request_env(user_token))

    expect(response.first).to eq(403)
  end

  it 'resolves the tenant from the authenticated token scheme' do
    organization = instance_double('Organization', id: 7)
    stub_const('Organization', class_double('Organization'))
    allow(Organization).to receive(:identify).with('acme').and_return(organization)

    TenantResolverMiddleware.new(app).call(request_env(token_for(scheme: 'acme')))

    expect(Current.organization).to eq(organization)
    expect(Current.tenant_id).to eq(7)
  end
end
