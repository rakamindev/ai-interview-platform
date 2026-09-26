# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Health check', type: :request do
  it 'answers ok' do
    get '/health'

    expect(response).to have_http_status(:ok)
    expect(JSON.parse(response.body)).to eq('status' => 'ok')
  end
end
