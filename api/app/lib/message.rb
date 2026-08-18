# frozen_string_literal: true

# Extracted from rakamin-api with AI interview additions.
class Message
  def self.not_found(record = 'record')
    "Sorry, #{record} not found."
  end

  def self.invalid_credentials
    'Invalid credentials'
  end

  def self.invalid_token
    'Invalid token'
  end

  def self.missing_token
    'Missing token'
  end

  def self.unauthorized
    'Unauthorized request'
  end

  def self.tenant_not_found
    'Tenant not found. Ensure the JWT scheme claim is valid.'
  end

  def self.assessment_error
    'Assessment not found or does not belong to your organization.'
  end

  def self.session_not_active
    'Session is not active.'
  end
end
