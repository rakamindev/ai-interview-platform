# frozen_string_literal: true

Rails.application.configure do
  config.lograge.enabled = true
  config.lograge.formatter = Lograge::Formatters::Json.new

  config.lograge.custom_options = lambda do |event|
    # Pull correlation ID from Current if set, fall back to event payload
    correlation_id = Current.correlation_id rescue nil

    {
      time: event.time.iso8601(3),
      request_id: event.payload[:request_id],
      remote_ip: event.payload[:remote_ip],
      user_id: event.payload[:user_id],
      correlation_id: correlation_id
    }.compact
  end
end
