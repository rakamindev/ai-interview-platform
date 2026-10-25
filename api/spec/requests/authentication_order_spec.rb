# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Authentication callback ordering', type: :request do
  it 'returns an authentication error before resolving a tenant when the token is missing' do
    get '/api/v1/assessments'

    expect(response).to have_http_status(:unauthorized)
    expect(response.parsed_body.dig('errors', 0, 'message')).to eq('Missing token')
  end
end
