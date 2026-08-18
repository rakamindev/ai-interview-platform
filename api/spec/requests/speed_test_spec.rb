# frozen_string_literal: true

require 'rails_helper'

# The candidate runs this from the hardware check, seconds before an interview.
# It used to be timed against Google, jsDelivr, unpkg, httpbin.org and
# postman-echo.com, which handed a candidate's IP address to five companies the
# consent notice never named. Serving the bytes ourselves is what removes that
# disclosure, so these specs guard the endpoint that made it possible.
RSpec.describe 'Speed test', type: :request do
  describe 'GET /api/v1/speed_test' do
    it 'serves the requested number of bytes without authentication' do
      get '/api/v1/speed_test', params: { bytes: 128 * 1024 }

      expect(response).to have_http_status(:ok)
      expect(response.body.bytesize).to eq(128 * 1024)
      expect(response.headers['Content-Type']).to eq('application/octet-stream')
    end

    it 'refuses to be used as a bandwidth amplifier' do
      get '/api/v1/speed_test', params: { bytes: 500_000_000 }

      expect(response.body.bytesize).to eq(2 * 1024 * 1024)
    end

    it 'still sends enough bytes to time when asked for a trivial amount' do
      get '/api/v1/speed_test', params: { bytes: 1 }

      expect(response.body.bytesize).to eq(64 * 1024)
    end

    it 'defaults to a usable payload when no size is given' do
      get '/api/v1/speed_test'

      expect(response.body.bytesize).to eq(512 * 1024)
    end

    it 'is never cached — a cached response would measure nothing' do
      get '/api/v1/speed_test'

      expect(response.headers['Cache-Control']).to include('no-store')
    end

    it 'sends different bytes each time, so compression cannot flatter the result' do
      get '/api/v1/speed_test', params: { bytes: 64 * 1024 }
      first = response.body
      get '/api/v1/speed_test', params: { bytes: 64 * 1024 }

      expect(response.body).not_to eq(first)
    end
  end

  describe 'POST /api/v1/speed_test' do
    it 'reports the bytes it received' do
      post '/api/v1/speed_test',
           params: 'x' * 4096,
           headers: { 'Content-Type' => 'application/octet-stream' }

      expect(response).to have_http_status(:ok)
      expect(JSON.parse(response.body)['received_bytes']).to eq(4096)
    end
  end
end
