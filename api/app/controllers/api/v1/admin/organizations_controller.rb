# frozen_string_literal: true

module Api
  module V1
    module Admin
      # Allows platform Super Admins to provision and list client organizations (tenants).
      class OrganizationsController < ApiController
        skip_before_action :require_tenant!
        authorize_auth_token! :admin

        # GET /api/v1/admin/organizations
        def index
          organizations = Organization.order(created_at: :desc)
          json_response({ organizations: organizations.map { |o| serialize_organization(o) } })
        end

        # POST /api/v1/admin/organizations
        def create
          org_params = params.require(:organization).permit(:name, :scheme, :identifier, :host)
          org = Organization.new(org_params)

          if org.save
            json_response({ organization: serialize_organization(org) }, :created)
          else
            json_error(org.errors.full_messages.join(', '), :unprocessable_entity)
          end
        end

        private

        def serialize_organization(org)
          {
            id: org.id,
            name: org.name,
            scheme: org.scheme,
            identifier: org.identifier,
            host: org.host,
            created_at: org.created_at
          }
        end
      end
    end
  end
end
