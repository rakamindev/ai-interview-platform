# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Speed test', type: :request do
  it 'accepts a small payload' do
    post '/api/v1/speed_test', params: 'x'
    expect(response).to have_http_status(:ok)
  end

  it 'rejects an oversized payload (P6-4)' do
    post '/api/v1/speed_test', headers: { 'CONTENT_LENGTH' => (20 * 1024 * 1024).to_s }
    expect(response).to have_http_status(:payload_too_large)
  end
end
