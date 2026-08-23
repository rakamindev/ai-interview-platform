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

  def paginated_response(collection, serializer: nil, **extra)
    data = serializer ? collection.map { |r| serializer.new(r).as_json } : collection.as_json
    render json: { data:, meta: pagination_meta(collection) }.merge(extra)
  end

  # Single source of truth for pagination metadata.
  # Shape is locked by ResponseContracts::PAGINATION_META_KEYS.
  def pagination_meta(collection)
    {
      current_page: collection.current_page,
      total_pages:  collection.total_pages,
      total_count:  collection.total_count,
      per_page:     collection.limit_value
    }
  end
end
