# frozen_string_literal: true

# Handles unmatched routes with the API's JSON error contract.
# Only reachable via the catch-all route for /api/* paths.
class ErrorsController < ActionController::API
  def not_found
    render json: { errors: [{ status: 404, message: "Route not found" }] }, status: :not_found
  end
end
