# 03-centralized-portfolio-and-override-tenant-scoping

Status: closed
Blocked by: 02-user-organization-binding-and-auth

## Context
Portfolios and override controllers execute unscoped database lookups (`Portfolio.find(params[:id])`), allowing an authenticated user in Tenant A to inspect, override, and export candidate portfolios from Tenant B (IDOR).

## Implementation Details
1. Add tenant scope to `api/app/models/portfolio.rb`:
   `scope :for_tenant, ->(tenant_id) { joins(:session).where(sessions: { tenant_id: tenant_id }) }`
2. Refactor `api/app/controllers/api/v1/portfolios_controller.rb`:
   - Use `before_action :set_portfolio` across all member actions (`show`, `export`, `fitgap`, `regenerate_fitgap`, `show_fitgap`).
   - Implement `set_portfolio` as:
     `@portfolio = Portfolio.for_tenant(Current.tenant_id).find(params[:id])`
3. Refactor `api/app/controllers/api/v1/portfolio_skills_controller.rb`:
   - Implement `set_portfolio_skill` as:
     `@portfolio_skill = PortfolioSkill.joins(portfolio: :session).where(sessions: { tenant_id: Current.tenant_id }).find(params[:id])`
4. Add request specs in `api/spec/requests/api/v1/portfolios_spec.rb` verifying that accessing another tenant's portfolio or override returns 404 Not Found.

## Verification
- `cd api && bundle exec rspec spec/requests/api/v1/portfolios_spec.rb`
