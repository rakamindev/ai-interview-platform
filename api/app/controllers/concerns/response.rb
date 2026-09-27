# frozen_string_literal: true

# Extracted from rakamin-api and simplified for AI interview.
module Response
  private

  def json_response(object, status = :ok)
    render json: object, status: status
  end

  def json_error(message, status = :unprocessable_entity, details: nil)
    payload = { errors: [{ status: Rack::Utils.status_code(status), message: }] }
    payload[:errors][0][:detail] = details if details
    render json: payload, status:
  end
end
