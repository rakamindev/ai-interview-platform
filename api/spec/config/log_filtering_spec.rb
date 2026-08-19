# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Log parameter filtering (P6-1)' do
  it 'filters sensitive params from logs' do
    filtered = Rails.application.config.filter_parameters
    expect(filtered).to include(:password)
    expect(filtered).to include(:token)
    expect(filtered).to include(:secret)
  end
end
