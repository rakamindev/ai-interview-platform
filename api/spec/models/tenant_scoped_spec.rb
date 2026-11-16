# frozen_string_literal: true

require 'rails_helper'

RSpec.describe TenantScoped do
  describe 'tenant query scoping' do
    it 'filters records to the current tenant when tenant context is set' do
      tenant_a = create(:assessment, tenant_id: 101)
      create(:assessment, tenant_id: 202)

      Current.using(tenant_id: 101) do
        expect(Assessment.pluck(:id)).to eq([tenant_a.id])
      end
    end

    it 'assigns the current tenant to new records when not explicitly supplied' do
      Current.using(tenant_id: 303) do
        assessment = build(:assessment, tenant_id: nil)
        expect(assessment).to be_valid
        expect(assessment.tenant_id).to eq(303)
      end
    end

    it 'requires a tenant when no tenant id is provided' do
      assessment = build(:assessment, tenant_id: nil)
      expect(assessment).not_to be_valid
      expect(assessment.errors[:tenant_id]).to be_present
    end

    it 'restores the previous tenant context after the scoped block' do
      Current.using(tenant_id: 101) do
        expect(Current.tenant_id).to eq(101)
        Current.using(tenant_id: 202) { expect(Current.tenant_id).to eq(202) }
        expect(Current.tenant_id).to eq(101)
      end
    end
  end
end
