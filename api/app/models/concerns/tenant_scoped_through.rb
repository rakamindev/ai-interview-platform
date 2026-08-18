# frozen_string_literal: true

# Tenancy for records that have no tenant_id of their own.
#
# TenantScoped covers models that carry tenant_id directly (Assessment,
# Session, Vacancy). Everything hanging off a session — portfolios, their
# skills, assessor overrides, fit/gap reports — has no such column, so it was
# reachable with a bare `.find(params[:id])` from any authenticated assessor
# in any organization. The id is a sequential bigint, so guessing one is not
# a meaningful obstacle.
#
# These records hold interview transcripts, verbatim candidate quotes and
# competency judgements, which makes an unscoped lookup a cross-tenant
# disclosure of personal data rather than merely an authorization bug.
#
# Usage:
#
#   class Portfolio < ApplicationRecord
#     include TenantScopedThrough
#     tenant_scoped_through :session
#   end
#
#   Portfolio.in_current_tenant.find(params[:id])   # 404s across tenants
#
# Deliberately not a default_scope: background workers legitimately operate
# outside a request, where there is no Current.tenant_id to scope by, and a
# default_scope would either silently return nothing or force `unscoped`
# sprinkled through the workers. Making it an explicit scope keeps the
# request-path requirement visible at every call site.
module TenantScopedThrough
  extend ActiveSupport::Concern

  class_methods do
    # `path` is any association path that reaches `sessions`, in the form
    # accepted by `joins` — e.g. :session, { portfolio: :session }.
    def tenant_scoped_through(path)
      scope :in_current_tenant, lambda {
        if RequestStore.store.key?(:tenant_id)
          joins(path).where(sessions: { tenant_id: Current.tenant_id })
        else
          # Outside a request (workers, console, rake) there is no tenant to
          # scope to. Returning `all` matches how TenantScoped behaves.
          all
        end
      }
    end
  end
end
