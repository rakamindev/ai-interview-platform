# frozen_string_literal: true

# Extracted from rakamin-api and simplified for AI interview.
module Response
  private

  def json_response(object, status = :ok)
    render json: object, status: status
  end

  # code: a stable name the web can branch on (e.g. "not_retryable"). The message may change.
  def json_error(message, status = :unprocessable_entity, details: nil, code: nil)
    payload = { errors: [{ status: Rack::Utils.status_code(status), message: }] }
    payload[:errors][0][:code] = code if code
    payload[:errors][0][:detail] = details if details
    render json: payload, status:
  end

  def paginated_response(collection, serializer: nil, **extra)
    meta = {
      current_page: collection.current_page,
      total_pages:  collection.total_pages,
      total_count:  collection.total_count,
      per_page:     collection.limit_value
    }

    data = serializer ? collection.map { |r| serializer.new(r).as_json } : collection.as_json
    render json: { data:, meta: }.merge(extra)
  end
end
