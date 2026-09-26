# frozen_string_literal: true

module Api
  module V1
    # GET /api/v1/home — the review desk for assessors.
    class HomeController < ApiController
      authorize_auth_token! :assessor

      def show
        since = Time.zone.parse(params[:since].to_s) if params[:since].present?
        json_response(Home::Desk.new(since: since).as_json)
      rescue ArgumentError
        json_response(Home::Desk.new.as_json)
      end
    end
  end
end
