# frozen_string_literal: true

ENV['RAILS_ENV'] ||= 'test'

require_relative '../config/environment'
require 'rspec/rails'

Dir[File.join(__dir__, 'support/**/*.rb')].sort.each { |file| require file }

RSpec.configure do |config|
  # Each example runs inside a transaction and rolls back — no manual cleanup,
  # no leftover tenants between runs.
  config.use_transactional_fixtures = true
  config.infer_spec_type_from_file_location!

  config.include AuthHelpers, type: :request
  config.include TenantHelpers, type: :request

  config.after do
    Current.clear
  end
end
