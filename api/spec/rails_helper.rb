# frozen_string_literal: true

require "spec_helper"
ENV["RAILS_ENV"] ||= "test"
require_relative "../config/environment"

# Compat shim: Ruby 3.3+ removed ERB::ENCODING_FLAG which ActionView 7.0.x
# references in ActionView::Template::Handlers::ERB. Define it after Rails
# boots (so the class hierarchy exists) but before rspec/rails loads the
# ActionView testing infrastructure.
unless ActionView::Template::Handlers::ERB.const_defined?(:ENCODING_FLAG)
  ActionView::Template::Handlers::ERB.const_set(:ENCODING_FLAG, false)
end

require "rspec/rails"
require "database_cleaner/active_record"

Rails.root.glob("spec/support/**/*.rb").each { |f| require f }

RSpec.configure do |config|
  config.use_transactional_fixtures = false # DatabaseCleaner handles it
  config.infer_spec_type_from_file_location!
  config.filter_rails_from_backtrace!

  config.include FactoryBot::Syntax::Methods
  config.include TenantHelper
  config.include AuthHelper
  config.include GeminiHelper
end
