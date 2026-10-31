# frozen_string_literal: true

module Api
  module V1
    class ApiController < ApplicationController
      private

      def verify_authenticated_tenant!
        scheme = current_user&.scheme
        return if scheme.present? && scheme == current_organization.scheme

        raise ExceptionHandler::Unauthorized, 'The authenticated tenant does not match this request'
      end
    end
  end
end
