# frozen_string_literal: true

# The product names its Rack middleware AudioWebSocketMiddleware and
# CoverageWebSocketMiddleware. Register the acronym before Zeitwerk derives
# constants from *_websocket_middleware.rb filenames.
ActiveSupport::Inflector.inflections(:en) do |inflect|
  inflect.acronym "WebSocket"
end
