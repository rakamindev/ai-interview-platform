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
  # AI interview addition
  class TenantNotFound      < StandardError; end

  included do
    rescue_from StandardError do |e|
      render_exception(e)
    end

    rescue_from ActiveRecord::RecordNotFound do |e|
      json_error(e.message, :not_found, code: "not_found")
    end

    rescue_from ExceptionHandler::Unauthorized do |e|
      json_error(e.message, :forbidden, code: "unauthorized")
    end

    rescue_from ExceptionHandler::MissingToken,
                ExceptionHandler::InvalidToken do |e|
      code = if e.message.include?("CSRF")
               "csrf_mismatch"
             elsif e.message.include?("Missing")
               "missing_token"
             else
               "invalid_token"
             end
      json_error(e.message, :unauthorized, code: code)
    end

    rescue_from ExceptionHandler::TenantNotFound do |e|
      json_error(e.message, :forbidden, code: "tenant_not_found")
    end
  end

  private

  def render_exception(e)
    status = exception_status(e)
    message = Rails.env.production? ? human_message(e) : e.message
    code = case e
           when ActiveRecord::RecordInvalid, ActiveModel::StrictValidationFailed
             "validation_error"
           when ActionController::ParameterMissing
             "parameter_missing"
           else
             "internal_error"
           end

    render json: {
      errors: [{
        status:,
        message:,
        code:,
        backtrace: (Rails.env.development? ? e.backtrace&.first(10) : nil)
      }.compact]
    }, status: status
  end

  def exception_status(e)
    case e
    when ActiveRecord::RecordInvalid,
         ActiveModel::StrictValidationFailed,
         ActionController::ParameterMissing then 422
    when ExceptionHandler::Unauthorized then 403
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
