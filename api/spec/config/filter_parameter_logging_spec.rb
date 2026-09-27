# frozen_string_literal: true

require 'rails_helper'

# UU PDP data minimisation (finding F-DATA-4): request logs print the params of every call.
# Candidate names, assessor notes and invite tokens (a bearer credential) must be filtered.
RSpec.describe 'parameter filtering in request logs' do
  let(:filter) { ActiveSupport::ParameterFilter.new(Rails.application.config.filter_parameters) }

  it 'filters candidate personal data and invite tokens, including nested params' do
    filtered = filter.filter(
      'token'   => 'a' * 64,
      'session' => { 'candidate_name' => 'Test Candidate' },
      'override' => { 'assessor_notes' => 'Strong on SQL, weak on caching' },
      'email'   => 'admin@example.test',
      'password' => 'secret'
    )

    expect(filtered['token']).to eq('[FILTERED]')
    expect(filtered.dig('session', 'candidate_name')).to eq('[FILTERED]')
    expect(filtered.dig('override', 'assessor_notes')).to eq('[FILTERED]')
    expect(filtered['email']).to eq('[FILTERED]')
    expect(filtered['password']).to eq('[FILTERED]')
  end

  it 'leaves ordinary, non-personal params readable for debugging' do
    filtered = filter.filter('time_limit_min' => 30, 'format' => 'pdf', 'reason' => 'manual_assessor')

    expect(filtered).to eq('time_limit_min' => 30, 'format' => 'pdf', 'reason' => 'manual_assessor')
  end
end
