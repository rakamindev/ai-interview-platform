# frozen_string_literal: true

require 'rails_helper'

# Production eager-loads app/, development doesn't — so a file whose constant doesn't match its
# name only fails at production boot. This runs the same eager load inside the suite.
RSpec.describe 'Zeitwerk compliance' do
  it 'eager loads every file the way production boots' do
    expect { Rails.application.eager_load! }.not_to raise_error
  end
end
