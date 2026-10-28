# frozen_string_literal: true

ENV["RAILS_ENV"] ||= "test"
ENV["SECRET_KEY_BASE"] ||= "spec-only-secret-key-base-do-not-use-in-production"
ENV["GEMINI_API_KEY"] ||= "test-only-key"

require_relative "../config/environment"
abort("The RSpec suite must not run in production") if Rails.env.production?
require "rspec/rails"
require_relative "spec_helper"

RSpec.configure do |config|
  config.fixture_path = Rails.root.join("spec/fixtures")
  config.use_transactional_fixtures = true
  config.infer_spec_type_from_file_location!
end
