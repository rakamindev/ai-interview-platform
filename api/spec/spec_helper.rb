# frozen_string_literal: true

ENV['RAILS_ENV'] ||= 'test'

require_relative '../config/environment'
require 'rspec/rails'

RSpec.configure do |config|
  config.after do
    Current.clear
  end
end
