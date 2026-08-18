# frozen_string_literal: true

# Shared record builders. FactoryBot is available but building records
# directly keeps the harness explicit and free of factory drift.
module TestData
  module_function

  def create_organization(scheme: 'test-corp')
    Organization.create!(
      name: scheme.titleize, scheme: scheme, identifier: scheme,
      host: "#{scheme}.localhost", alias_hosts: [], config: {}
    )
  end

  def create_user(tenant:, email: 'admin@example.test', role: 'admin')
    User.create!(email: email, password: 'Password123!', role: role, tenant_id: tenant.id)
  end

  def create_assessment(tenant:, name: 'Test Role', language: 'en')
    Assessment.create!(
      tenant_id: tenant.id, created_by: 1, name: name,
      time_limit_min: 30, language: language
    )
  end

  def build_session(tenant:, assessment:)
    Session.create!(
      tenant_id: tenant.id, assessment_id: assessment.id,
      status: 'pending', invite_token: SecureRandom.hex(32)
    )
  end

  def create_consent(session:, status:)
    session.build_candidate_consent(policy_version: ConsentPolicy::POLICY_VERSION)
           .tap { |c| c.update!(status: status) }
  end
end

RSpec.configure do |config|
  config.include TestData
end
