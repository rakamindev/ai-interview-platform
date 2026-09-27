# frozen_string_literal: true

require 'rails_helper'

RSpec.describe TenantScoped, type: :model do
  let!(:org_a) { create(:organization, scheme: 'org-a') }
  let!(:org_b) { create(:organization, scheme: 'org-b') }
  let!(:assessor) { create(:user, :assessor, organization: org_a) }
  let!(:admin) { create(:user, :admin) }

  let!(:vacancy_a) { create(:vacancy, tenant_id: org_a.id, created_by: assessor.id) }
  let!(:vacancy_b) { create(:vacancy, tenant_id: org_b.id, created_by: assessor.id) }

  after do
    Current.clear
  end

  describe 'default_scope' do
    context 'when Current.user is an admin' do
      it 'unscopes queries to return records across all tenants' do
        Current.user = admin
        Current.tenant_id = org_a.id

        expect(Vacancy.all).to include(vacancy_a, vacancy_b)
      end
    end

    context 'when Current.user is an assessor' do
      it 'strictly scopes queries to Current.tenant_id' do
        Current.user = assessor
        Current.tenant_id = org_a.id

        expect(Vacancy.all).to include(vacancy_a)
        expect(Vacancy.all).not_to include(vacancy_b)
      end
    end

    context 'when no user or tenant is set' do
      it 'returns all records if tenant_id is not in RequestStore' do
        Current.clear
        expect(Vacancy.all).to include(vacancy_a, vacancy_b)
      end
    end
  end

  describe '#assign_tenant_id' do
    context 'when an explicit tenant_id is provided' do
      it 'preserves the provided tenant_id' do
        Current.user = admin
        Current.tenant_id = org_a.id

        v = Vacancy.create!(
          role_title: 'Backend Lead',
          created_by: admin.id,
          tenant_id: org_b.id
        )

        expect(v.tenant_id).to eq(org_b.id)
      end
    end

    context 'when no tenant_id is provided and Current.user is assessor' do
      it 'assigns Current.tenant_id automatically' do
        Current.user = assessor
        Current.tenant_id = org_a.id

        v = Vacancy.create!(
          role_title: 'Junior Engineer',
          created_by: assessor.id
        )

        expect(v.tenant_id).to eq(org_a.id)
      end
    end
  end
end
