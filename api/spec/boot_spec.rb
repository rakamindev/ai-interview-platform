# frozen_string_literal: true

require 'rails_helper'

# Production and CI eager-load the whole app. A file whose name does not match the constant it
# defines (Zeitwerk naming) only fails there, so check it explicitly even in a lazy test run.
RSpec.describe 'Application boot' do
  it 'eager loads every autoloadable constant (regression: *WebSocket* classes broke production boot)' do
    expect { Rails.autoloaders.main.eager_load(force: true) }.not_to raise_error
  end

  it 'resolves the websocket middleware constants the initializer inserts' do
    expect(AudioWebSocketMiddleware).to be_a(Class)
    expect(CoverageWebSocketMiddleware).to be_a(Class)
  end
end
