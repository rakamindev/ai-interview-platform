# frozen_string_literal: true

require 'rails_helper'

RSpec.describe AddTenantIdToPortfolioFamily do
  let(:migration) { described_class.new }

  before do
    allow(migration).to receive(:say_with_time).and_yield
  end

  describe '#up' do
    it 'runs without error' do
      expect { migration.up }.not_to raise_error
    end

    it 'adds NOT NULL tenant_id to all portfolio family tables' do
      migration.up

      %i[portfolios portfolio_skills fit_gap_reports assessor_overrides].each do |table|
        expect(connection.column_exists?(table, :tenant_id, null: false)).to be true
      end
    end

    it 'adds indexes on tenant_id' do
      migration.up

      %i[portfolios portfolio_skills fit_gap_reports assessor_overrides].each do |table|
        expect(connection.index_exists?(table, :tenant_id)).to be true
      end
    end
  end

  describe '#down' do
    it 'removes tenant_id columns from all portfolio family tables' do
      migration.down

      %i[portfolios portfolio_skills fit_gap_reports assessor_overrides].each do |table|
        expect(connection.column_exists?(table, :tenant_id)).to be false
      end
    end
  end

  describe 'backfill correctness' do
    it 'derives tenant_id from sessions.tenant_id through parent chains' do
      migration.up

      # Create test data with tenant_id
      org = create(:organization)
      session = create(:session, tenant_id: org.id)
      portfolio = create(:portfolio, session: session)
      portfolio_skill = create(:portfolio_skill, portfolio: portfolio)
      fit_gap_report = create(:fit_gap_report, portfolio: portfolio)
      assessor_override = create(:assessor_override, portfolio_skill: portfolio_skill)

      # Verify tenant_id propagated
      expect(portfolio.tenant_id).to eq(org.id)
      expect(portfolio_skill.tenant_id).to eq(org.id)
      expect(fit_gap_report.tenant_id).to eq(org.id)
      expect(assessor_override.tenant_id).to eq(org.id)
    end
  end

  private

  def connection
    ActiveRecord::Base.connection
  end
end
