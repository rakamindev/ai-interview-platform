# frozen_string_literal: true

class ApplicationController < ActionController::API
  include Response
  include ExceptionHandler

  before_action :require_tenant!
  before_action :verify_scheme_claim!, if: lambda {
    begin
      Current.user.present?
    rescue StandardError
      false
    end && begin
      Current.organization.present?
    rescue StandardError
      false
    end
  }

  # Declarative auth helper — mirrors rakamin-api's authorize_auth_token! pattern.
  # Usage:
  #   authorize_auth_token! :admin
  #   authorize_auth_token! :assessor      # allows admin or assessor
  #   authorize_auth_token! :any           # any authenticated user
  def self.authorize_auth_token!(*roles, **options)
    before_action(options) { authenticate_with_roles!(roles) }
  end

  private

  # ── Tenant ──────────────────────────────────────────────────────────────────

  # Raises TenantNotFound if tenant resolution failed (i.e. bad/missing scheme).
  # Override in controllers that don't require a tenant (e.g. health check).
  def require_tenant!
    return if tenant_resolved?

    raise ExceptionHandler::TenantNotFound, Message.tenant_not_found
  end

  # AC-4.6: reject when the JWT scheme claim disagrees with the resolved org.
  # This is a mitigation, not a repair — the scheme claim is unverifiable
  # inside this service because no user↔organisation membership exists (C1).
  def verify_scheme_claim!
    return if Current.user.scheme.blank?
    return if Current.user.scheme == Current.organization.scheme

    raise ExceptionHandler::Unauthorized, "Token scheme does not match the resolved organisation"
  end

  def tenant_resolved?
    RequestStore.store.key?(:organization) && Current.organization.present?
  rescue StandardError
    false
  end

  def current_tenant_id
    Current.tenant_id
  end

  def current_organization
    Current.organization
  rescue StandardError
    nil
  end

  # ── Auth ────────────────────────────────────────────────────────────────────

  def current_user
    Current.user
  rescue StandardError
    nil
  end

  def authenticate_with_roles!(roles)
    roles = roles.flatten.map(&:to_s)
    result = AuthorizeApiRequest.new(request.headers, roles).call
    Current.user = result[:user]
  end

  # ── Params ──────────────────────────────────────────────────────────────────

  def query_params
    @query_params ||= request.query_parameters.with_indifferent_access
  end

  def path_params
    @path_params ||= request.path_parameters
      .except(:controller, :action)
      .with_indifferent_access
  end

  def request_body
    @request_body ||= request.request_parameters.with_indifferent_access
  end

  def paginate(scope)
    page     = (query_params[:page] || 1).to_i
    per_page = [(query_params[:per_page] || 20).to_i, 100].min
    scope.page(page).per(per_page)
  end
end
