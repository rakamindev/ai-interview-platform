# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Zeitwerk' do
  it 'eager loads every application file' do
    expect { Rails.application.eager_load! }.not_to raise_error
  end
end
