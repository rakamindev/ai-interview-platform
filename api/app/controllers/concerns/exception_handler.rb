# frozen_string_literal: true

# Extracted and adapted from rakamin-api.
module ExceptionHandler
  extend ActiveSupport::Concern

  # Mirror rakamin-api error classes exactly so JWT tokens/errors are compatible
  class AuthenticationError < StandardError; end
  class Unauthorized        < StandardError; end
  class MissingToken        < StandardError; end
  class InvalidToken        < StandardError; end
  class NotFound            < StandardError; end
  class TenantNotFound      < StandardError; end  # AI interview addition

  included do
    rescue_from StandardError do |e|
      render_exception(e)
    end

    rescue_from ActiveRecord::RecordNotFound do |e|
      render json: { errors: [{ status: 404, message: e.message }] }, status: :not_found
    end

    rescue_from ExceptionHandler::Unauthorized do |e|
      render json: { errors: [{ status: 403, message: e.message }] }, status: :forbidden
    end

    rescue_from ExceptionHandler::MissingToken,
                ExceptionHandler::InvalidToken do |e|
      render json: { errors: [{ status: 401, message: e.message }] }, status: :unauthorized
    end

    rescue_from ExceptionHandler::TenantNotFound do |e|
      render json: { errors: [{ status: 403, message: e.message }] }, status: :forbidden
    end
  end

  private

  def render_exception(e)
    status = exception_status(e)
    message = Rails.env.production? ? human_message(e) : e.message

    render json: {
      errors: [{
        status:,
        message:,
        backtrace: (Rails.env.development? ? e.backtrace&.first(10) : nil)
      }.compact]
    }, status: status
  end

  def exception_status(e)
    case e
    when ActiveRecord::RecordInvalid,
         ActiveModel::StrictValidationFailed,
         ActionController::ParameterMissing  then 422
    when ExceptionHandler::Unauthorized       then 403
    when ExceptionHandler::MissingToken,
         ExceptionHandler::InvalidToken       then 401
    when ActiveRecord::RecordNotFound         then 404
    else                                           500
    end
  end

  def human_message(e)
    case e
    when ActiveRecord::RecordInvalid then e.record.errors.full_messages.first
    else "An unexpected error occurred."
    end
  end
end
