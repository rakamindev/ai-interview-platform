# frozen_string_literal: true

require 'rails_helper'

RSpec.describe FitGapReport, type: :model do
  describe 'tenant scoping' do
    let!(:tenant_a) { create(:organization) }
    let!(:tenant_b) { create(:organization) }

    let!(:report_a) do
      in_tenant(tenant_a) do
        create(:fit_gap_report, portfolio: create(:portfolio), vacancy: create(:vacancy))
      end
    end
    let!(:report_b) do
      in_tenant(tenant_b) do
        create(:fit_gap_report, portfolio: create(:portfolio), vacancy: create(:vacancy))
      end
    end

    it 'scopes lookups to the current tenant' do
      with_tenant(tenant_a) do
        expect(FitGapReport.all).to contain_exactly(report_a)
      end

      with_tenant(tenant_b) do
        expect(FitGapReport.all).to contain_exactly(report_b)
      end
    end

    it 'does not leak reports across tenants via find_by' do
      with_tenant(tenant_b) do
        found = FitGapReport.find_by(portfolio_id: report_a.portfolio_id, vacancy_id: report_a.vacancy_id)
        expect(found).to be_nil
      end
    end

    it 'persists an explicitly supplied tenant_id (worker path supplies portfolio.tenant_id)' do
      portfolio = in_tenant(tenant_a) { create(:portfolio) }
      vacancy = in_tenant(tenant_a) { create(:vacancy) }

      # Simulate a Sidekiq worker (no Current tenant): the caller supplies
      # tenant_id explicitly (FitGap::Engine derives it from the portfolio).
      Current.clear
      report = FitGapReport.create!(
        portfolio_id: portfolio.id,
        vacancy_id:   vacancy.id,
        tenant_id:    portfolio.tenant_id,
        skill_comparisons: [{ 'skill_label' => 'X' }]
      )

      expect(report.tenant_id).to eq(portfolio.tenant_id)

      with_tenant(tenant_a) { expect(FitGapReport.find(report.id)).to eq(report) }
    end
  end
end