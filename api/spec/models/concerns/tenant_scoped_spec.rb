# frozen_string_literal: true

require 'rails_helper'

RSpec.describe TenantScoped, type: :model do
  before { with_tenant(1) }

  describe 'default_scope' do
    let!(:session1) { create(:session, tenant_id: 1) }
    let!(:session2) { create(:session, tenant_id: 2) }

    it 'filters by Current.tenant_id' do
      with_tenant(1) do
        expect(Session.all.map(&:tenant_id)).to all(eq(1))
      end

      with_tenant(2) do
        expect(Session.all.map(&:tenant_id)).to all(eq(2))
      end
    end

    it 'returns all when no tenant_id set' do
      Current.clear
      expect { Session.all }.not_to raise_error
    end
  end

  describe 'assign_tenant_id callback' do
    let(:assessment) { create(:assessment, tenant_id: 1) }

    it 'sets tenant_id from Current on create' do
      with_tenant(42) do
        session = create(:session, assessment: assessment, invite_token: 'test')
        expect(session.tenant_id).to eq(42)
      end
    end

    it 'does not override explicitly set tenant_id' do
      assessment = create(:assessment, tenant_id: 1)
      with_tenant(1) do
        session = create(:session, assessment: assessment, tenant_id: 99, invite_token: 'test2')
        expect(session.tenant_id).to eq(99)
      end
    end
  end

  describe 'tenant_id validation' do
    it 'requires tenant_id when Current.tenant_id is nil' do
      Current.tenant_id = nil
      session = Session.new(assessment: create(:assessment, tenant_id: 1), invite_token: 'test')
      session.tenant_id = nil
      expect(session).not_to be_valid
      expect(session.errors[:tenant_id]).to include("can't be blank")
    end
  end
end