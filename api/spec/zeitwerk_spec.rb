# frozen_string_literal: true

require 'rails_helper'

# Guards the whole autoload tree, not one constant. Any file whose name stops agreeing with
# the constant it defines fails here, and it fails the same way whether or not eager loading
# happens to be switched on for the environment running the suite — which is the property the
# original defect lacked. Two middlewares had been mismatched since the initial import and
# stayed invisible locally, because config/initializers/websocket.rb require_relative's them
# and lazy loading never asked Zeitwerk to derive their names.
RSpec.describe 'Zeitwerk' do
  it 'eager loads every autoloaded file without a naming mismatch' do
    expect { Rails.application.eager_load! }.not_to raise_error
  end
end
