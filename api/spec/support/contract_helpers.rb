# frozen_string_literal: true

# Exact-shape assertions for the list-vs-detail contract specs
# (see api/docs/contracts.md and the serializer-contract-tests change).
module ContractHelpers
  # Asserts the response body has exactly +expected_keys+ (stringified).
  # Used to lock serializer shapes so drift (added/removed/renamed keys)
  # fails the suite instead of silently reaching the frontend.
  def expect_json_keys(body, expected_keys)
    expect(body.keys.sort).to eq(expected_keys.map(&:to_s).sort)
  end
end
