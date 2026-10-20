# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Parameter Filtering Configuration', type: :request do
  let(:filter) { ActiveSupport::ParameterFilter.new(Rails.application.config.filter_parameters) }

  it 'filters passwords and authentication tokens' do
    raw_params = { password: 'secret_password_123', auth_token: 'jwt.token.here', secret_key: 'topsecret' }
    filtered = filter.filter(raw_params)

    expect(filtered[:password]).to eq('[FILTERED]')
    expect(filtered[:auth_token]).to eq('[FILTERED]')
    expect(filtered[:secret_key]).to eq('[FILTERED]')
  end

  it 'filters candidate PII and invite tokens to comply with UU PDP Article 16/20' do
    raw_params = {
      candidate_name: 'Budi Santoso',
      invite_token: 'a1b2c3d4e5f6',
      evidence: 'candidate said something sensitive',
      api_key: 'gemini-live-secret-key',
      safe_param: 'public_value'
    }
    filtered = filter.filter(raw_params)

    expect(filtered[:candidate_name]).to eq('[FILTERED]')
    expect(filtered[:invite_token]).to eq('[FILTERED]')
    expect(filtered[:evidence]).to eq('[FILTERED]')
    expect(filtered[:api_key]).to eq('[FILTERED]')
    expect(filtered[:safe_param]).to eq('public_value')
  end
end
