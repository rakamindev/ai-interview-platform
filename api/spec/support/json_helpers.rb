# frozen_string_literal: true

module JsonHelpers
  def json_body
    JSON.parse(response.body)
  end
end

RSpec.configure do |config|
  config.include JsonHelpers, type: :request
end
