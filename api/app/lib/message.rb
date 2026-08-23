# frozen_string_literal: true

# Extracted from rakamin-api with AI interview additions.
class Message
  def self.not_found(record = "record")
    { message: "Sorry, #{record} not found.", code: "not_found" }
  end

  def self.invalid_credentials
    { message: "Invalid credentials", code: "invalid_credentials" }
  end

  def self.invalid_token
    { message: "Invalid token", code: "invalid_token" }
  end

  def self.missing_token
    { message: "Missing token", code: "missing_token" }
  end

  def self.unauthorized
    { message: "Unauthorized request", code: "unauthorized" }
  end

  def self.tenant_not_found
    { message: "Tenant not found. Ensure the JWT scheme claim is valid.", code: "tenant_not_found" }
  end

  def self.assessment_error
    { message: "Assessment not found or does not belong to your organization.", code: "assessment_not_found" }
  end

  def self.session_not_active
    { message: "Session is not active.", code: "session_not_active" }
  end
end
