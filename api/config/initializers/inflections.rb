# frozen_string_literal: true

# Match the existing middleware constants when Zeitwerk eager-loads in CI/production.
ActiveSupport::Inflector.inflections(:en) do |inflect|
  inflect.acronym 'WebSocket'
end
