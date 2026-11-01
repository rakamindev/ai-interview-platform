# frozen_string_literal: true

# Captures the params Rails writes to the request log for whatever the block requests.
module LoggedParams
  def logged_params(&)
    logged = nil
    callback = ->(*, payload) { logged = payload[:params] }
    ActiveSupport::Notifications.subscribed(callback, 'process_action.action_controller', &)
    logged.to_s
  end
end
