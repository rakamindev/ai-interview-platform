# frozen_string_literal: true

module TestDataHelper
  def create_organization(attrs = {})
    id = attrs[:id] || (Organization.maximum(:id) || 0) + 10
    scheme = attrs[:scheme] || "org_#{SecureRandom.hex(4)}"
    Organization.create!(
      {
        id: id,
        name: "Test Org #{id}",
        scheme: scheme,
        identifier: scheme,
        host: "#{scheme}.example.com",
        alias_hosts: [],
        config: {}
      }.merge(attrs)
    )
  end

  def create_user(attrs = {})
    email = attrs[:email] || "user_#{SecureRandom.hex(4)}@example.com"
    User.create!(
      {
        email: email,
        password: SecureRandom.hex(12),
        role: "admin"
      }.merge(attrs)
    )
  end
end

RSpec.configure do |config|
  config.include TestDataHelper
end
