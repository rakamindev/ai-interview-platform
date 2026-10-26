# frozen_string_literal: true

# Portfolios, portfolio skills and fit/gap reports have no tenant_id column:
# they inherit tenancy from their Session. Every lookup by id from a
# controller MUST go through these scopes so an assessor can never reach
# another tenant's candidate data (UU PDP). Misses raise RecordNotFound,
# which callers render as 404 to avoid leaking existence.
module TenantOwnedRecords
  extend ActiveSupport::Concern

  private

  def tenant_portfolios
    Portfolio.joins(:session).where(sessions: { tenant_id: current_tenant_id })
  end

  def tenant_portfolio_skills
    PortfolioSkill.joins(portfolio: :session).where(sessions: { tenant_id: current_tenant_id })
  end
end
