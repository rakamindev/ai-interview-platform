# frozen_string_literal: true

# Unit specs opt in to application files explicitly; never boot Rails or load local credentials here.
RSpec.configure do |config|
  config.disable_monkey_patching!
  config.order = :random
end
