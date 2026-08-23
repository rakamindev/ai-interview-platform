# frozen_string_literal: true

module RequestSpecHelper
  def json_response
    JSON.parse(response.body)
  end

  def authenticated_header(user, organization: nil)
    org = organization || user.organization || Organization.first || create(:organization)
    token = JsonWebToken.encode(
      user_id: user.id,
      email: user.email,
      scheme: org.scheme,
      role: user.role
    )

    {
      'Authorization' => "Bearer #{token}",
      'Content-Type'  => 'application/json',
      'Host'          => org.host || "#{org.scheme}.example.com"
    }
  end

  def tenant_header(organization)
    {
      'Host' => organization.host || "#{organization.scheme}.example.com",
      'Content-Type' => 'application/json'
    }
  end
end
