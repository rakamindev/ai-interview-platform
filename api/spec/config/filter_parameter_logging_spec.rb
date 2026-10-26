# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'parameter filtering (AC22)' do
  let(:filter) { ActiveSupport::ParameterFilter.new(Rails.application.config.filter_parameters) }

  it 'redacts candidate personal data and secrets from logged params' do
    filtered = filter.filter(
      'session' => { 'candidate_name' => 'Kandidat Fiktif', 'invite_token' => 'abc' },
      'override' => { 'override_level' => 3, 'assessor_notes' => 'notes about a person' },
      'password' => 'x'
    )

    expect(filtered.to_s).not_to include('Kandidat Fiktif', 'abc', 'notes about a person')
    expect(filtered.dig('override', 'override_level')).to eq(3)
  end
end
