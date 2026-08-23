# frozen_string_literal: true

require 'rails_helper'

# Portfolios and everything hanging off them carry no tenant_id, so they were
# reachable with a bare `.find(params[:id])` from any authenticated assessor
# in any organization. The records hold interview transcripts, verbatim
# candidate quotes and competency judgements, which makes that a cross-tenant
# disclosure of personal data rather than only an authorization defect.
RSpec.describe TenantScopedThrough do
  let(:tenant_a) { create_organization(scheme: 'tenant-a') }
  let(:tenant_b) { create_organization(scheme: 'tenant-b') }

  # One fully populated candidate inside tenant A.
  let!(:fixture_a) do
    as_tenant(tenant_a) do
      assessment = create(:assessment, name: 'A assessment')
      session    = create(:session, assessment: assessment, candidate_name: 'Candidate A')
      portfolio  = create(:portfolio, session: session)
      skill      = create(:portfolio_skill, portfolio: portfolio, skill_label: 'A skill')
      override   = create(:assessor_override, portfolio_skill: skill)
      vacancy    = create(:vacancy, role_title: 'A role')
      report     = FitGapReport.create!(
        portfolio: portfolio, vacancy: vacancy, skill_comparisons: [], narrative_status: 'complete'
      )
      { portfolio: portfolio, skill: skill, override: override, report: report }
    end
  end

  describe 'Portfolio' do
    it 'is visible to its own tenant' do
      as_tenant(tenant_a) do
        expect(Portfolio.in_current_tenant.find(fixture_a[:portfolio].id)).to eq(fixture_a[:portfolio])
      end
    end

    it 'is not readable from another tenant' do
      as_tenant(tenant_b) do
        expect { Portfolio.in_current_tenant.find(fixture_a[:portfolio].id) }
          .to raise_error(ActiveRecord::RecordNotFound)
      end
    end

    it 'is still reachable unscoped, which is what the old controllers did' do
      as_tenant(tenant_b) do
        expect(Portfolio.find(fixture_a[:portfolio].id)).to eq(fixture_a[:portfolio])
      end
    end
  end

  describe 'PortfolioSkill' do
    it 'is not writable from another tenant' do
      as_tenant(tenant_b) do
        expect { PortfolioSkill.in_current_tenant.find(fixture_a[:skill].id) }
          .to raise_error(ActiveRecord::RecordNotFound)
      end
    end

    it 'is visible to its own tenant' do
      as_tenant(tenant_a) do
        expect(PortfolioSkill.in_current_tenant.find(fixture_a[:skill].id)).to eq(fixture_a[:skill])
      end
    end
  end

  describe 'FitGapReport' do
    it 'is not readable from another tenant' do
      as_tenant(tenant_b) do
        expect { FitGapReport.in_current_tenant.find(fixture_a[:report].id) }
          .to raise_error(ActiveRecord::RecordNotFound)
      end
    end
  end

  describe 'AssessorOverride' do
    it 'is not readable from another tenant' do
      as_tenant(tenant_b) do
        expect { AssessorOverride.in_current_tenant.find(fixture_a[:override].id) }
          .to raise_error(ActiveRecord::RecordNotFound)
      end
    end
  end

  describe 'outside a request' do
    # Sidekiq workers run with no tenant in RequestStore and must still see
    # the records they were handed.
    it 'does not filter when no tenant is set' do
      RequestStore.clear!
      expect(Portfolio.in_current_tenant.where(id: fixture_a[:portfolio].id)).to exist
    end
  end
end
