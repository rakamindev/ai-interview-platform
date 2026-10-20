# frozen_string_literal: true

require 'rails/rack/logger'

class RedactedRackLogger < Rails::Rack::Logger
  INVITE_TOKEN_PATH = %r{(/api/v1/sessions/)[^/?\s]+(/(?:candidate|audio_complete|privacy_acknowledgement))}

  def started_request_message(request)
    path = request.filtered_path
    super.gsub(path, path.gsub(INVITE_TOKEN_PATH, '\\1[FILTERED]\\2'))
  end
end
