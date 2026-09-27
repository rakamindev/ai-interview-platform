# frozen_string_literal: true

RSpec.configure do |config|
  config.before { RequestStore.clear! }
  config.after  { RequestStore.clear! }
end
