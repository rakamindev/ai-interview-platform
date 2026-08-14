# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Tenant scoping (TenantScoped concern)', type: :model do
  before do
    @a1 = create(:assessment, tenant_id: 1, name: 'Tenant 1 assessment')
    @a2 = create(:assessment, tenant_id: 2, name: 'Tenant 2 assessment')
  end

  it 'returns only the current tenant\'s records when tenant context is set' do
    with_tenant(1) do
      expect(Assessment.count).to eq(1)
      expect(Assessment.pluck(:tenant_id).uniq).to eq([1])
    end

    with_tenant(2) do
      expect(Assessment.count).to eq(1)
      expect(Assessment.first).to eq(@a2)
    end
  end

  it 'assigns tenant_id from the current tenant on create' do
    with_tenant(42) do
      record = Assessment.create!(created_by: 1, name: 'Auto tenant', time_limit_min: 30)
      expect(record.tenant_id).to eq(42)
    end
  end

  it 'returns no records when no tenant context is set (P1-3)' do
    expect(Assessment.count).to eq(0)
    expect(Assessment.unscoped.count).to eq(2)
  end

  describe 'belongs_to associations resolve without tenant context (P1-3 safety net)' do
    it 'Session#assessment loads with no tenant set' do
      assessment = create(:assessment, tenant_id: 7, name: 'Owned assessment')
      session    = create(:session, assessment: assessment, tenant_id: 7)

      loaded = Session.unscoped.find(session.id)
      expect(loaded.assessment).to eq(assessment)
    end

    it 'Portfolio#session loads with no tenant set' do
      session   = create(:session, tenant_id: 9)
      portfolio = create(:portfolio, session: session)

      expect(Portfolio.find(portfolio.id).session).to eq(session)
    end
  end
end
