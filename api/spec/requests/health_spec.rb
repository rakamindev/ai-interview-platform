# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Health', type: :request do
  it 'returns ok' do
    get '/api/v1/health'
    expect(response).to have_http_status(:ok)
    expect(JSON.parse(response.body)).to eq('status' => 'ok')
  end
end
