# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Filter Parameter Logging (N05)' do
  it 'filters password from logs' do
    expect(Rails.application.config.filter_parameters).to include(:password)
  end

  it 'filters token from logs' do
    expect(Rails.application.config.filter_parameters).to include(:token)
  end

  it 'filters api_key from logs' do
    expect(Rails.application.config.filter_parameters).to include(:api_key)
  end

  it 'filters secret_key_base from logs' do
    expect(Rails.application.config.filter_parameters).to include(:secret_key_base)
  end

  it 'filters invite_token from logs' do
    expect(Rails.application.config.filter_parameters).to include(:invite_token)
  end

  it 'actually masks filtered values' do
    filter = ActiveSupport::ParameterFilter.new(Rails.application.config.filter_parameters)
    filtered = filter.filter(
      'password' => 'secret123',
      'token' => 'jwt_abc',
      'api_key' => 'gemini_key',
      'name' => 'John'
    )

    expect(filtered['password']).to eq('[FILTERED]')
    expect(filtered['token']).to eq('[FILTERED]')
    expect(filtered['api_key']).to eq('[FILTERED]')
    expect(filtered['name']).to eq('John')  # not filtered
  end
end
