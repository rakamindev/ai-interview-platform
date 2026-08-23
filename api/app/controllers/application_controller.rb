# frozen_string_literal: true

class ApplicationController < ActionController::API
  include ActionController::Cookies
  include Response
  include ExceptionHandler

  before_action :require_tenant!

  # Declarative auth helper — mirrors rakamin-api's authorize_auth_token! pattern.
  # Usage:
  #   authorize_auth_token! :admin
  #   authorize_auth_token! :assessor      # admin or Membership.role == "assessor"
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

  # AC-4.6: reject when no active membership exists for the user in the
  # resolved org, or when the JWT scheme claim disagrees with the resolved org.
  def verify_scheme_claim!
    # Reuse the membership AuthorizeApiRequest already resolved for this
    # user+org this request, if any, instead of querying it again.
    cached = Current.membership { nil }
    membership = if cached && cached.user_id == Current.user.id && cached.organization_id == Current.organization.id
                   cached
                 else
                   Membership.find_by(
                     user_id: Current.user.id,
                     organization_id: Current.organization.id
                   )
                 end

    raise ExceptionHandler::Unauthorized, "No active membership in this organization" unless membership

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
    result = AuthorizeApiRequest.new(request.headers, roles, cookies: cookies).call
    Current.user = result[:user]

    # AC-4.6, run here (not as a separate before_action) so it's guaranteed to
    # execute after Current.user is set — before_actions declared on this
    # parent class run before ones added by subclasses via authorize_auth_token!,
    # so a plain `before_action :verify_scheme_claim!` here would always fire
    # before Current.user exists and silently no-op.
    verify_scheme_claim! if current_organization.present?
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
