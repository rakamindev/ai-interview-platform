# frozen_string_literal: true

# Unified error envelope (F-26): every HTTP error response in the API uses
# the single shape { error: { code, message, details? } }.
#
#   render json: ErrorEnvelope.payload(message: '...', status: :not_found), status: :not_found
#
# The `code` is derived from the HTTP status unless an explicit, more specific
# code is passed (e.g. tenant_not_found for a 403 caused by unassigned tenant).
module ErrorEnvelope
  ERROR_CODES = {
    400 => 'bad_request',
    401 => 'unauthorized',
    403 => 'forbidden',
    404 => 'not_found',
    409 => 'conflict',
    422 => 'validation_failed',
    429 => 'rate_limited',
    500 => 'internal_error'
  }.freeze

  def self.payload(message:, status:, code: nil, details: nil)
    status_code = status.is_a?(Symbol) ? Rack::Utils.status_code(status) : status
    error = {
      code: code || ERROR_CODES.fetch(status_code, 'error'),
      message: message
    }
    error[:details] = details if details
    { error: error }
  end
end