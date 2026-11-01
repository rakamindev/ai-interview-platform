# frozen_string_literal: true

module Api
  module V1
    # Public: a landing-page visitor has no account, so there is no JWT and no tenant.
    class DemoRequestsController < ApiController
      skip_before_action :require_tenant!

      # POST /api/v1/demo_requests
      def create
        payload = params[:demo_request]
        unless payload.is_a?(ActionController::Parameters)
          return json_error('Invalid demo request', :unprocessable_entity)
        end

        demo_request = DemoRequest.new(payload.permit(:name, :email, :company, :message))

        if demo_request.save
          json_response({ demo_request: { id: demo_request.id } }, :created)
        else
          json_error(demo_request.errors.full_messages.first, :unprocessable_entity)
        end
      end
    end
  end
end
