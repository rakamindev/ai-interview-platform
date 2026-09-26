# frozen_string_literal: true

class ApplicationController < ActionController::API
  include Response
  include ExceptionHandler

  before_action :require_tenant!

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
    return scope if query_params[:all] == 'true'

    page     = (query_params[:page] || 1).to_i
    per_page = [(query_params[:per_page] || 10).to_i, 100].min
    scope.page(page).per(per_page)
  end

  def pagination_meta(collection)
    if query_params[:all] == 'true'
      count = collection.respond_to?(:total_count) ? collection.total_count : collection.size
      return {
        current_page: 1,
        total_pages:  1,
        total_count:  count,
        per_page:     count
      }
    end

    {
      current_page: collection.current_page,
      total_pages:  collection.total_pages,
      total_count:  collection.total_count,
      per_page:     collection.limit_value
    }
  end
end
