# frozen_string_literal: true

# Base middleware class extracted from rakamin-api.
class ApplicationMiddleware
  def initialize(app)
    @app = app
  end

  def call(env)
    @app.call(env)
  end

  private

  def error(status, message)
    json = ErrorEnvelope.payload(message:, status:).to_json

    charset = ActionDispatch::Response.default_charset
    headers = {
      'Content-Type' => "application/json; charset=#{charset}",
      'Content-Length' => json.bytesize.to_s
    }

    [status, headers, [json]]
  end
end
