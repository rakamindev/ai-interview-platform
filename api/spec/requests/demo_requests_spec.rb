# frozen_string_literal: true

require 'rails_helper'
require 'support/logged_params'

RSpec.describe 'POST /api/v1/demo_requests', :aggregate_failures do
  include LoggedParams

  let(:valid_fields) do
    { name: 'Sari Wijaya', email: 'sari@example.test', company: 'Example Corp', message: 'Engineers' }
  end

  # Throttle counters live in the cache store; use a private one so specs never share the dev Redis.
  around do |example|
    original_store = Rack::Attack.cache.store
    Rack::Attack.cache.store = ActiveSupport::Cache::MemoryStore.new
    example.run
  ensure
    Rack::Attack.cache.store = original_store
  end

  def submit(body)
    post '/api/v1/demo_requests', params: body.to_json, headers: { 'Content-Type' => 'application/json' }
  end

  it 'stores the request without a token or tenant' do
    expect { submit(demo_request: valid_fields) }.to change(DemoRequest, :count).by(1)

    expect(response).to have_http_status(:created)
    expect(DemoRequest.last).to have_attributes(valid_fields)
  end

  it 'rejects an invalid request without storing it' do
    expect { submit(demo_request: valid_fields.merge(email: 'nope')) }.not_to change(DemoRequest, :count)

    expect(response).to have_http_status(:unprocessable_entity)
    expect(response.parsed_body.dig('errors', 0, 'message')).to include('Email')
  end

  [
    ['a root string', 'hello'],
    ['a root array', [1, 2]],
    ['a root null', nil],
    ['an empty object', {}],
    ['a string payload', { demo_request: 'hello' }],
    ['an array payload', { demo_request: [{ name: 'Sari' }] }],
    ['a null payload', { demo_request: nil }],
    ['an object name', { demo_request: { name: { first: 'Sari' }, email: 'a@b.test', company: 'C' } }],
    ['an array email', { demo_request: { name: 'Sari', email: ['a@b.test'], company: 'C' } }],
    ['a null company', { demo_request: { name: 'Sari', email: 'a@b.test', company: nil } }],
    ['a name made only of a null byte', { demo_request: { name: "\u0000", email: 'a@b.test', company: 'C' } }]
  ].each do |description, body|
    it "answers #{description} with 422 and stores nothing" do
      expect { submit(body) }.not_to change(DemoRequest, :count)

      expect(response).to have_http_status(:unprocessable_entity)
    end
  end

  it 'stores a name containing a null byte without it instead of failing' do
    submit(demo_request: valid_fields.merge(name: "Sari\u0000 Wijaya"))

    expect(response).to have_http_status(:created)
    expect(DemoRequest.last.name).to eq('Sari Wijaya')
  end

  it 'ignores attributes that are not part of the form' do
    submit(demo_request: valid_fields.merge(id: 999, created_at: '2000-01-01'))

    expect(DemoRequest.last.id).not_to eq(999)
    expect(DemoRequest.last.created_at.year).not_to eq(2000)
  end

  it 'throttles a visitor who submits too many requests' do
    5.times { submit(demo_request: valid_fields) }

    expect { submit(demo_request: valid_fields) }.not_to change(DemoRequest, :count)

    expect(response).to have_http_status(:too_many_requests)
  end

  it 'keeps the personal data out of the logged parameters' do
    logged = logged_params { submit(demo_request: valid_fields) }

    expect(logged).not_to include('Sari Wijaya', 'sari@example.test', 'Example Corp', 'Engineers')
  end
end
