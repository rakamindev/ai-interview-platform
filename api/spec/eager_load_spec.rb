# frozen_string_literal: true

require 'rails_helper'

# Production and CI eager load the app. Loading everything here catches
# file/constant name mismatches (Zeitwerk) locally instead of on a server.
RSpec.describe 'Eager loading' do
  it 'loads every application file without Zeitwerk naming errors' do
    expect { Zeitwerk::Loader.eager_load_all }.not_to raise_error
  end
end
