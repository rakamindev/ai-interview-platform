# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'JWT Unresolved Scheme Characterization', type: :request do
  let!(:user) { User.create!(email: 'admin_test@example.com', password: 'password123', role: 'admin') }

  describe 'Valid signed JWT with missing or unresolvable scheme claim' do
    it 'characterizes that a JWT without a scheme claim is rejected with status 403' do
      token_without_scheme = JsonWebToken.encode({ user_id: user.id, role: 'admin' })

      get '/api/v1/assessments', headers: {
        'Authorization' => "Bearer #{token_without_scheme}",
        'Content-Type' => 'application/json'
      }

      expect(response).to have_http_status(:forbidden)
      body = JSON.parse(response.body)
      expect(body['errors'].first['message']).to include('Tenant not found')
    end

    it 'characterizes that a JWT with an unmapped scheme is rejected with status 403' do
      token_with_bogus_scheme = JsonWebToken.encode({ user_id: user.id, role: 'admin', scheme: 'unregistered-org-999' })

      get '/api/v1/assessments', headers: {
        'Authorization' => "Bearer #{token_with_bogus_scheme}",
        'Content-Type' => 'application/json'
      }

      expect(response).to have_http_status(:forbidden)
      body = JSON.parse(response.body)
      expect(body['errors'].first['message']).to include('Tenant not found')
    end
  end
end
