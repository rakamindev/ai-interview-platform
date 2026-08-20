# frozen_string_literal: true

module RecordHelpers
  def create_organization
    suffix = SecureRandom.hex(4)
    Organization.create!(
      name: "Test Organization #{suffix}",
      scheme: "test-#{suffix}",
      identifier: "test-#{suffix}",
      host: "test-#{suffix}.example.com"
    )
  end

  def within_tenant(organization, &block)
    Current.using(organization: organization, tenant_id: organization.id, &block)
  end

  def create_assessment(organization, name: 'Backend Engineer')
    within_tenant(organization) do
      Assessment.create!(
        tenant_id: organization.id,
        created_by: 1,
        name: name,
        time_limit_min: 30,
        language: 'en'
      )
    end
  end

  def create_interview_session(assessment, attributes = {})
    within_tenant(assessment.tenant_id.then { Organization.find(_1) }) do
      assessment.sessions.create!({ tenant_id: assessment.tenant_id }.merge(attributes))
    end
  end

  def assessor_headers(organization)
    token = JsonWebToken.encode(user_id: 1, role: 'admin', scheme: organization.scheme)
    { 'Authorization' => "Bearer #{token}" }
  end

  def response_json
    JSON.parse(response.body)
  end
end
