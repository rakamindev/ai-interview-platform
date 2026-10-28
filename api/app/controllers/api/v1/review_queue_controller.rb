# frozen_string_literal: true

module Api
  module V1
    # Portfolios of the current organisation that still need a human review.
    class ReviewQueueController < ApiController
      authorize_auth_token! :assessor

      # GET /api/v1/review_queue?reason=skills&page=1
      def index
        result = Portfolios::ReviewQueue.new(tenant_id: current_tenant_id, group: params[:reason],
                                             page: params[:page] || 1).call
        Rails.logger.info("[ReviewQueue] tenant=#{current_tenant_id} items=#{result[:items].size} " \
                          "total=#{result[:meta][:total_count]}")
        json_response(result)
      rescue Portfolios::ReviewQueue::UnknownGroup
        json_error('Unknown review reason', :unprocessable_entity)
      end
    end
  end
end
