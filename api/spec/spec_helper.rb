# frozen_string_literal: true

RSpec.configure do |config|
  config.expect_with :rspec do |c|
    c.syntax = :expect
  end
  config.order = :random
  Kernel.srand config.seed
end
