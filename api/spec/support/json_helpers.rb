# frozen_string_literal: true

# spec/support/json_helpers.rb
#
# Helpers for API contract/response verification.
#
# - json_body            : parses response.body
# - expect_json_response : HTTP status + JSON content-type
# - expect_keys          : EXACT key-set of a JSON object.
#                          Fails if any key is missing OR unexpected,
#                          so refactors that change the response shape
#                          cannot pass without updating the tests.
# - expect_all_keys      : expect_keys for every element of an array
# - expect_timestamp     : value in ISO8601 timestamp format (from AR as_json)
# - expect_error         : standard error shape { errors: [{ status:, message: }] }
module JsonHelpers
  def json_body
    JSON.parse(response.body)
  end

  def expect_json_response(status: :ok)
    expect(response).to have_http_status(status)
    expect(response.content_type).to include('application/json')
  end

  # Exact key-set verification (no more, no less).
  #   expect_keys(json_body['session'], :id, :status, :invite_url)
  def expect_keys(object, *expected_keys)
    expected = expected_keys.map(&:to_s).sort
    actual   = object.keys.sort

    missing = expected - actual
    extra   = actual - expected

    message = <<~MESSAGE.strip
      Response key mismatch.
        Missing keys: #{missing.join(', ')}
        Unexpected keys: #{extra.join(', ')}
        Expected: #{expected.join(', ')}
        Actual:   #{actual.join(', ')}
    MESSAGE

    expect(actual).to eq(expected), message
  end

  # Apply expect_keys to every element of an array.
  def expect_all_keys(array, *expected_keys)
    expect(array).to be_an_instance_of(Array)
    array.each do |element|
      expect_keys(element, *expected_keys) if element.is_a?(Hash)
    end
  end

  # ActiveRecord (as_json) serialized timestamp → ISO8601 UTC.
  def expect_timestamp(value)
    expect(value).to match(/\A\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\z/),
      "expected #{value.inspect} to be an ISO8601 UTC timestamp"
  end

  # All listed keys must be integers (not strings).
  def expect_integers(hash, *keys)
    keys.each do |key|
      expect(hash[key.to_s]).to be_a(Integer),
        "expected #{key} to be an Integer, got #{hash[key.to_s].class}"
    end
  end

  def expect_error(status:, message: nil)
    expect(response).to have_http_status(status)

    expect(json_body).to have_key('errors')
    errors = json_body['errors']
    expect(errors).to be_an_instance_of(Array)
    expect(errors).not_to be_empty

    first = errors.first
    expect(first).to include('status', 'message')
    expect(first['status']).to eq(Rack::Utils.status_code(status))
    expect(first['message']).to include(message) if message
  end
end

RSpec.configure do |config|
  config.include JsonHelpers, type: :request
end
