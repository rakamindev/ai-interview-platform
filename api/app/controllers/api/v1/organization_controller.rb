# frozen_string_literal: true

module Api
  module V1
    class OrganizationController < ApiController
      authorize_auth_token! :admin

      # GET /api/v1/organization
      def show
        org = current_organization || Organization.first
        if org
          json_response(organization: org_json(org))
        else
          json_error('Organization not found', :not_found)
        end
      end

      # PUT /api/v1/organization
      def update
        org = current_organization || Organization.first
        return json_error('Organization not found', :not_found) unless org

        if org.update(org_params)
          json_response(organization: org_json(org))
        else
          json_error(org.errors.full_messages.first, :unprocessable_entity)
        end
      end

      private

      def org_params
        params.require(:organization).permit(:name, :host, config: {})
      end

      def org_json(org)
        {
          id:         org.id,
          name:       org.name,
          scheme:     org.scheme,
          identifier: org.identifier,
          host:       org.host,
          config:     org.config,
          created_at: org.created_at,
          updated_at: org.updated_at
        }
      end
    end
  end
end
