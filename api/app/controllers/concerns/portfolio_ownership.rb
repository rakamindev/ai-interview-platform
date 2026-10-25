# frozen_string_literal: true

# Enforces that a Portfolio (and anything reached through it — PortfolioSkill,
# AssessorOverride, FitGapReport) belongs to the current tenant.
#
# Portfolio/PortfolioSkill/AssessorOverride/FitGapReport have no tenant_id
# column of their own (see db/schema.rb) and can't include TenantScoped, so
# ownership must be checked explicitly via portfolio.session.tenant_id —
# Session is the nearest tenant-scoped ancestor in the association chain.
module PortfolioOwnership
  extend ActiveSupport::Concern

  private

  # Raises ActiveRecord::RecordNotFound (not a 403) when the portfolio does
  # not belong to Current.tenant_id. 404 instead of 403 is deliberate: a 403
  # would confirm to a cross-tenant caller that a portfolio with that ID
  # exists at all (an enumeration oracle against sequential PKs). Every call
  # site already has a local rescue ActiveRecord::RecordNotFound that renders
  # the same "not found" JSON it renders for a truly-missing ID, so this is
  # indistinguishable from "doesn't exist" to the caller.
  #
  # Looks up the session's tenant_id via Session.unscoped rather than
  # portfolio.session: Session's own TenantScoped default_scope would filter
  # a cross-tenant session out of that association entirely (returning nil,
  # not the other tenant's session), which is exactly the wrong failure mode
  # here — it would raise NoMethodError instead of denying access. Same
  # .unscoped + explicit tenant_id comparison idiom AudioWebSocketMiddleware
  # already uses for this same class of problem.
  def authorize_portfolio!(portfolio)
    session_tenant_id = Session.unscoped.where(id: portfolio.session_id).pick(:tenant_id)
    return portfolio if session_tenant_id == Current.tenant_id

    raise ActiveRecord::RecordNotFound, "Portfolio not found"
  end
end
