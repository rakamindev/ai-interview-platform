# frozen_string_literal: true

# One line per request, with no parameter hash and no SQL.
# Replaces ActionController's "Processing by" / "Parameters" / "Completed" dump.
# The "Started ..." line from Rails::Rack::Logger remains.
module StructuredRequestLogging
  def start_processing(_event)
    # Intentionally empty. Parameters are not a request log.
  end

  def process_action(event)
    payload = event.payload
    status = payload[:status]
    if status.nil? && (exception_class = payload[:exception]&.first)
      status = ActionDispatch::ExceptionWrapper.status_code_for_exception(exception_class)
    end

    parts = [
      "method=#{payload[:method]}",
      "path=#{safe_path(payload)}",
      "action=#{payload[:controller]}##{payload[:action]}",
      "status=#{status}",
      "duration_ms=#{event.duration.round(1)}"
    ]

    if (db_ms = payload[:db_runtime])
      parts << "db_ms=#{db_ms.round(1)}"
    end

    request_id = payload[:request]&.request_id
    parts << "request_id=#{request_id}" if request_id.present?

    organization = RequestStore.store[:organization]
    parts << "tenant=#{organization.scheme}" if organization&.scheme.present?

    if (exception_class = payload[:exception]&.first)
      parts << "error=#{exception_class}"
    end

    info(parts.join(" "))
  end

  private

  def safe_path(payload)
    request = payload[:request]
    return payload[:path].to_s unless request

    path = request.filtered_path.to_s
    token = request.path_parameters[:token].to_s
    return path if token.length < 8

    path.gsub(token, "[FILTERED]")
  end
end

Rails.application.config.after_initialize do
  require "action_controller/log_subscriber"
  next if ActionController::LogSubscriber < StructuredRequestLogging
  ActionController::LogSubscriber.prepend(StructuredRequestLogging)
end