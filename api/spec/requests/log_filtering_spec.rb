# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Request logs', type: :request do
  it 'never show the password or email from a login' do
    post '/api/v1/auth/login', params: { email: 'someone@example.com', password: 'not-for-logs' }, as: :json

    expect(request.filtered_parameters).to include('email' => '[FILTERED]', 'password' => '[FILTERED]')
  end

  it 'hide invite tokens, candidate names and review notes' do
    filter = ActiveSupport::ParameterFilter.new(Rails.application.config.filter_parameters)

    filtered = filter.filter(
      'token' => 'abc123',
      'session' => { 'candidate_name' => 'Sekar' },
      'override' => { 'assessor_notes' => 'private note', 'override_level' => 3 }
    )

    expect(filtered).to eq(
      'token' => '[FILTERED]',
      'session' => { 'candidate_name' => '[FILTERED]' },
      'override' => { 'assessor_notes' => '[FILTERED]', 'override_level' => 3 }
    )
  end
end
