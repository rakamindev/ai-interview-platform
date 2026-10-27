# frozen_string_literal: true

ENV["RAILS_ENV"] ||= "test"

require_relative "../config/environment"
abort("Rails is running in production mode!") if Rails.env.production?

require "rspec/rails"

RSpec.configure do |config|
  config.infer_spec_type_from_file_location!
end
