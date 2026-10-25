# frozen_string_literal: true

require_relative '../../spec_helper'
require_relative '../../../app/clients/gemini/http_client'
require 'faraday'

RSpec.describe Gemini::HttpClient do
  FakeResponse = Struct.new(:status, :body) do
    def success? = (200..299).cover?(status)
  end

  # Duck-types the Faraday connection seam: records requested URLs and yields
  # per-call behavior so specs can fail the primary model and heal on fallback.
  class FakeConnection
    attr_reader :requested_urls

    def initialize(&behavior)
      @behavior = behavior
      @requested_urls = []
    end

    def post(url, _body, _headers)
      @requested_urls << url
      @behavior.call(@requested_urls.length)
    end
  end

  def client_with(&behavior)
    described_class.new(
      model:           'gemini-pro',
      api_key:         'test-key',
      fallback_models: ['gemini-flash-lite'],
      connection:      FakeConnection.new(&behavior)
    )
  end

  def ok_body(text)
    { candidates: [{ content: { parts: [{ text: text }] } }] }.to_json
  end

  it 'falls back to the next model when the primary times out (network errors must carry a status)' do
    client = client_with do |call|
      call == 1 ? raise(Faraday::TimeoutError, 'connection timed out') : FakeResponse.new(200, ok_body('{"ok": true}'))
    end

    expect(client.generate_content('ping')).to eq('ok' => true)
    urls = client.instance_variable_get(:@connection).requested_urls
    expect(urls.length).to eq(2)
    expect(urls.first).to include('models/gemini-pro:generateContent')
    expect(urls.last).to include('models/gemini-flash-lite:generateContent')
  end

  it 'falls back when the connection fails outright' do
    client = client_with do |call|
      call == 1 ? raise(Faraday::ConnectionFailed, 'connection refused') : FakeResponse.new(200, ok_body('{"ok": true}'))
    end

    expect(client.generate_content('ping')).to eq('ok' => true)
    expect(client.instance_variable_get(:@connection).requested_urls.length).to eq(2)
  end

  it 'falls back when the primary returns 200 but no usable content' do
    client = client_with do |call|
      call == 1 ? FakeResponse.new(200, '{"candidates": []}') : FakeResponse.new(200, ok_body('{"ok": true}'))
    end

    expect(client.generate_content('ping')).to eq('ok' => true)
    expect(client.instance_variable_get(:@connection).requested_urls.length).to eq(2)
  end

  it 'still falls back on 404 model-not-found (regression guard)' do
    client = client_with do |call|
      call == 1 ? FakeResponse.new(404, 'model not found') : FakeResponse.new(200, ok_body('{"ok": true}'))
    end

    expect(client.generate_content('ping')).to eq('ok' => true)
    expect(client.instance_variable_get(:@connection).requested_urls.length).to eq(2)
  end

  it 'raises immediately on a 500 — fallback only covers reject/unusable statuses' do
    client = client_with { FakeResponse.new(500, 'boom') }

    expect { client.generate_content('ping') }.to raise_error(Gemini::HttpClient::ApiError)
    expect(client.instance_variable_get(:@connection).requested_urls.length).to eq(1)
  end

  it 'falls back on 429 and raises RateLimitError only after every candidate is throttled' do
    client = client_with { FakeResponse.new(429, 'rate limited') }

    expect { client.generate_content('ping') }.to raise_error(Gemini::HttpClient::RateLimitError)
    expect(client.instance_variable_get(:@connection).requested_urls.length).to eq(2)
  end

  it 'raises the timeout with its synthetic status when every candidate times out' do
    client = client_with { raise Faraday::TimeoutError, 'connection timed out' }

    expect { client.generate_content('ping') }
      .to raise_error(Gemini::HttpClient::TimeoutError) { |e| expect(e.status).to eq(503) }
    expect(client.instance_variable_get(:@connection).requested_urls.length).to eq(2)
  end
end
