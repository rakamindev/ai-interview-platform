# frozen_string_literal: true

require 'rails_helper'

# Speed test endpoints (P2-7): the candidate hardware check probes the
# platform's own API so healthy connections aren't rejected because third-party
# test services are slow, blocked, or CORS-restricted.
RSpec.describe 'Speed test', type: :request do
  it 'GET streams a 3 MiB no-store payload for download measurement' do
    get '/api/v1/speed_test'

    expect(response).to have_http_status(:ok)
    expect(response.content_type).to eq('application/octet-stream')
    expect(response.headers['Cache-Control']).to include('no-store')
    expect(response.body.bytesize).to eq(3 * 1024 * 1024)
  end

  it 'POST accepts a payload and reports the bytes received' do
    payload = 'x' * 4096

    post '/api/v1/speed_test', params: payload, headers: { 'Content-Type' => 'application/octet-stream' }

    expect(response).to have_http_status(:ok)
    expect(JSON.parse(response.body)['received_bytes']).to eq(4096)
  end

  it 'does not require authentication (candidate-facing)' do
    get '/api/v1/speed_test'

    expect(response).to have_http_status(:ok)
  end
end
