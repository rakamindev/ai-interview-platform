# frozen_string_literal: true

module OrganizationHelpers
  def within_organization(organization = @organization, &block)
    if organization.nil?
      raise ArgumentError, 'within_organization needs an organization (set @organization or pass one)'
    end

    Current.using(organization: organization, tenant_id: organization.id, &block)
  end
end

RSpec.configure do |config|
  config.include OrganizationHelpers
end
