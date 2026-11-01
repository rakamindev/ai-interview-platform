# frozen_string_literal: true

require 'rails_helper'
require 'support/logged_params'

RSpec.describe 'Request parameter logging', :aggregate_failures do
  include LoggedParams

  around do |example|
    original_store = Rack::Attack.cache.store
    Rack::Attack.cache.store = ActiveSupport::Cache::MemoryStore.new
    example.run
  ensure
    Rack::Attack.cache.store = original_store
  end

  def invite_request_for(candidate_name)
    organization = Organization.create!(name: 'Test Corp', scheme: 'test-corp', identifier: 'test-corp',
                                        host: 'test.example.com')
    assessment = Assessment.create!(tenant_id: organization.id, created_by: 7, name: 'Backend', time_limit_min: 30)
    token = JsonWebToken.encode(user_id: 7, role: 'admin', scheme: organization.scheme)

    post "/api/v1/assessments/#{assessment.id}/sessions", params: { session: { candidate_name: } },
                                                          headers: { 'Authorization' => "Bearer #{token}" }
  end

  it 'filters login credentials' do
    logged = logged_params { post '/api/v1/auth/login', params: { email: 'a@example.test', password: 'secret-value' } }

    expect(logged).not_to include('a@example.test', 'secret-value')
  end

  it 'filters the candidate name' do
    expect(logged_params { invite_request_for('Budi Santoso') }).not_to include('Budi Santoso')
  end
end
