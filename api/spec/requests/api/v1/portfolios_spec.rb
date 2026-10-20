# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Api::V1::Portfolios', type: :request do
  let!(:org_a) do
    Organization.create!(
      name: 'Tenant Alpha',
      scheme: 'tenant-alpha',
      identifier: 'tenant-alpha',
      host: 'tenant-alpha.test',
      config: {}
    )
  end

  let!(:org_b) do
    Organization.create!(
      name: 'Tenant Beta',
      scheme: 'tenant-beta',
      identifier: 'tenant-beta',
      host: 'tenant-beta.test',
      config: {}
    )
  end

  let!(:assessment_a) do
    Assessment.create!(
      tenant_id: org_a.id,
      created_by: 1,
      name: 'Alpha Software Engineer Assessment',
      time_limit_min: 30
    )
  end

  let!(:session_a) do
    Session.create!(
      tenant_id: org_a.id,
      assessment: assessment_a,
      status: 'ended',
      candidate_name: 'Jane Doe'
    )
  end

  let!(:portfolio_a) do
    Portfolio.create!(
      session: session_a,
      generation_status: 'complete',
      generated_at: Time.current
    )
  end

  let(:token_a) do
    JsonWebToken.encode({ user_id: 1, role: 'assessor', scheme: org_a.scheme })
  end

  let(:token_b) do
    JsonWebToken.encode({ user_id: 2, role: 'assessor', scheme: org_b.scheme })
  end

  describe 'GET /api/v1/portfolios/:id/export' do
    it 'returns 404 when an assessor from Tenant B attempts to access a portfolio belonging to Tenant A' do
      get "/api/v1/portfolios/#{portfolio_a.id}/export",
          headers: { 'Authorization' => "Bearer #{token_b}" }

      expect(response).to have_http_status(:not_found)
      json = JSON.parse(response.body)
      expect(json['errors'].first['message']).to match(/Portfolio not found/i)
    end

    it 'returns 200 when an assessor from Tenant A accesses their own portfolio' do
      get "/api/v1/portfolios/#{portfolio_a.id}/export",
          headers: { 'Authorization' => "Bearer #{token_a}" }

      expect(response).to have_http_status(:ok)
    end
  end

  describe 'POST /api/v1/portfolios/:id/fitgap' do
    it 'returns 404 when an assessor from Tenant B attempts to calculate fitgap on Tenant A portfolio' do
      post "/api/v1/portfolios/#{portfolio_a.id}/fitgap",
           params: { vacancy_id: 123 },
           headers: { 'Authorization' => "Bearer #{token_b}" }

      expect(response).to have_http_status(:not_found)
    end
  end

  describe 'PDF caching and rate limiting (EXP-03)' do
    before do
      Rails.cache.clear
    end

    it 'caches rendered PDF bytes on subsequent export requests' do
      memory_store = ActiveSupport::Cache.lookup_store(:memory_store)
      allow(Rails).to receive(:cache).and_return(memory_store)

      pdf_generator_double = instance_double(Exports::PdfGenerator, call: '%PDF-1.4 dummy')
      allow(Exports::PdfGenerator).to receive(:new).and_return(pdf_generator_double)

      get "/api/v1/portfolios/#{portfolio_a.id}/export?format=pdf",
          headers: { 'Authorization' => "Bearer #{token_a}" }

      expect(response).to have_http_status(:ok)
      expect(Exports::PdfGenerator).to have_received(:new).once

      get "/api/v1/portfolios/#{portfolio_a.id}/export?format=pdf",
          headers: { 'Authorization' => "Bearer #{token_a}" }

      expect(response).to have_http_status(:ok)
      expect(Exports::PdfGenerator).to have_received(:new).once
    end

    it 'throttles export requests exceeding 10 per minute per IP with HTTP 429' do
      Rack::Attack.enabled = true
      Rack::Attack.reset!

      pdf_generator_double = instance_double(Exports::PdfGenerator, call: '%PDF-1.4 dummy')
      allow(Exports::PdfGenerator).to receive(:new).and_return(pdf_generator_double)

      10.times do
        get "/api/v1/portfolios/#{portfolio_a.id}/export",
            headers: { 'Authorization' => "Bearer #{token_a}", 'REMOTE_ADDR' => '192.168.1.100' }
      end

      get "/api/v1/portfolios/#{portfolio_a.id}/export",
          headers: { 'Authorization' => "Bearer #{token_a}", 'REMOTE_ADDR' => '192.168.1.100' }

      expect(response).to have_http_status(:too_many_requests)
      json = JSON.parse(response.body)
      expect(json['error']).to match(/Too many requests/i)
    ensure
      Rack::Attack.enabled = false
    end
  end
end
