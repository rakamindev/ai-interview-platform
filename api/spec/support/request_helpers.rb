# frozen_string_literal: true

# Helpers shared by request specs: default tenant org + JWT auth headers.
module RequestSpecHelpers
  # Ensures the default Organization used by tenant resolution (scheme test-corp)
  # exists. It is normally seeded; this is a safety net and must NOT force a
  # conflicting id — the resolved tenant must match the vacancy factory's tenant_id.
  def ensure_default_org
    Organization.find_or_create_by(scheme: "test-corp") do |org|
      org.name       = "Test Org"
      org.identifier = "test-corp"
      org.host       = "localhost"
    end
  end

  def auth_token(role: "admin", scheme: "test-corp", user_id: 1)
    JsonWebToken.encode({ user_id:, role:, scheme: })
  end

  def auth_headers(role: "admin", scheme: "test-corp", user_id: 1)
    { "Authorization" => "Bearer #{auth_token(role:, scheme:, user_id:)}" }
  end
end

RSpec.configure do |config|
  config.include RequestSpecHelpers, type: :request

  config.before(:each, type: :request) do
    ensure_default_org
    # Integration tests default to host "www.example.com", which Rails'
    # HostAuthorization blocks. Point at an allowed host.
    host! 'localhost'
  end
end
