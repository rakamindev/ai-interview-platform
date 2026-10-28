# frozen_string_literal: true

require 'rails_helper'

# AC10.1: request parameters are logged at :info, which is the production log level. Credentials
# and personal data about candidates must never reach the logs (UU PDP).
RSpec.describe 'parameter filtering for logs' do
  let(:filter) { ActiveSupport::ParameterFilter.new(Rails.application.config.filter_parameters) }

  # Credential-like values are generated per run: the spec only checks that they are replaced, and a
  # literal password in the repo, even a fake one, trips secret scanners.
  {
    'password'       => SecureRandom.hex(8),
    'token'          => SecureRandom.hex(8),
    'email'          => 'fake.user@example.test',
    'candidate_name' => 'Dewi Lestari (fake)',
    'assessor_notes' => 'Struggled with the follow-up question.',
    'text'           => 'A sentence the candidate said.',
    'api_key'        => SecureRandom.hex(8)
  }.each do |key, value|
    it "filters #{key}" do
      expect(filter.filter(key => value)[key]).to eq('[FILTERED]')
    end
  end

  it 'filters nested params, as sent by the override and session endpoints' do
    filtered = filter.filter('override' => { 'override_level' => 4, 'assessor_notes' => 'private' },
                             'session'  => { 'candidate_name' => 'Dewi Lestari (fake)' })

    expect(filtered.dig('override', 'assessor_notes')).to eq('[FILTERED]')
    expect(filtered.dig('session', 'candidate_name')).to eq('[FILTERED]')
  end

  it 'keeps non-sensitive params readable for debugging' do
    filtered = filter.filter('override_level' => 4, 'vacancy_id' => 7, 'format' => 'pdf')

    expect(filtered).to eq('override_level' => 4, 'vacancy_id' => 7, 'format' => 'pdf')
  end
end
