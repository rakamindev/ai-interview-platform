# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Parameter Filtering (AC-S3, F-09)', type: :request do
  let(:filter) { ActiveSupport::ParameterFilter.new(Rails.application.config.filter_parameters) }
  # Generated at runtime so no credential-like literal lands in the repo (secret scanners flag those).
  let(:sensitive_value) { SecureRandom.hex(8) }

  it 'filters passwords, candidate names, assessor notes, tokens, and sensitive text' do
    params = {
      'user' => {
        'email' => 'user@example.com',
        'password' => sensitive_value,
        'password_confirmation' => sensitive_value
      },
      'candidate_name' => 'Budi Santoso',
      'token' => sensitive_value,
      'secret' => sensitive_value,
      'override' => {
        'override_level' => 4,
        'assessor_notes' => 'Candidate passed private company test'
      },
      'text' => 'Direct transcript statement'
    }

    filtered = filter.filter(params)

    expect(filtered['user']['password']).to eq('[FILTERED]')
    expect(filtered['user']['password_confirmation']).to eq('[FILTERED]')
    expect(filtered['candidate_name']).to eq('[FILTERED]')
    expect(filtered['token']).to eq('[FILTERED]')
    expect(filtered['secret']).to eq('[FILTERED]')
    expect(filtered['override']['assessor_notes']).to eq('[FILTERED]')
    expect(filtered['text']).to eq('[FILTERED]')
    # Non-sensitive fields remain visible
    expect(filtered['user']['email']).to eq('user@example.com')
    expect(filtered['override']['override_level']).to eq(4)
  end
end
