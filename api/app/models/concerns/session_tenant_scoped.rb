# frozen_string_literal: true

# Tenant scoping for the portfolio tree.
#
# Portfolio, PortfolioSkill, FitGapReport, TranscriptTurn and CoverageMap have
# no tenant_id of their own, so TenantScoped could not be applied to them and
# every controller lookup was global:
#
#   Portfolio.find(params[:id])                        # portfolios#fitgap, #export
#   PortfolioSkill.joins(:portfolio).find(params[:id]) # portfolio_skills#override
#
# An authenticated assessor in one tenant could therefore read another tenant's
# candidate evidence quotes, export them as PDF, and write overrides onto them.
# Under UU PDP that is unlawful processing of personal data belonging to people
# who never chose to use this product.
#
# The fix scopes through the association chain to `sessions`, which does carry
# tenant_id, rather than denormalising the column onto four more tables. That
# keeps a single source of truth for tenancy — a copied tenant_id can drift out
# of agreement with its session, and a leak caused by drift is silent.
#
# Fails closed: with no tenant in context the scope returns `none`, not
# everything. Sidekiq workers have no request context and must therefore opt
# out explicitly, which makes each of those decisions visible in review.
module SessionTenantScoped
  extend ActiveSupport::Concern

  class_methods do
    # `path` is the association route from this model to :session, e.g.
    #   scoped_to_tenant_through :session
    #   scoped_to_tenant_through portfolio: :session
    def scoped_to_tenant_through(path)
      scope :for_current_tenant, lambda {
        next none unless RequestStore.store.key?(:tenant_id)

        joins(path).where(sessions: { tenant_id: Current.tenant_id })
      }
    end
  end
end
