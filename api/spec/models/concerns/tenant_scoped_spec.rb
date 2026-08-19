require 'rails_helper'

RSpec.describe TenantScoped, type: :model do
  # We'll create a dummy model that acts as an ActiveRecord class with this concern
  # and a table in the database if necessary, but we can also use an existing model like User or Assessment
  
  describe 'scoping' do
    let!(:org1) { Current.organization }
    let!(:org2) { create(:organization, id: 100, scheme: 'org2') }
    let!(:assessment1) { create(:assessment, tenant_id: org1.id) }
    let!(:assessment2) { create(:assessment, tenant_id: org2.id) }
    
    after do
      Current.clear
    end

    context 'when RequestStore has tenant_id' do
      before do
        RequestStore.store[:tenant_id] = org1.id
        Current.tenant_id = org1.id
      end

      it 'scopes queries to the current tenant' do
        expect(Assessment.all).to include(assessment1)
        expect(Assessment.all).not_to include(assessment2)
      end

      it 'assigns tenant_id on create' do
        new_assessment = Assessment.create!(name: 'Test Assessment', time_limit_min: 30, created_by: 1)
        expect(new_assessment.tenant_id).to eq(org1.id)
      end
    end

    context 'when RequestStore does not have tenant_id' do
      before do
        Current.clear
      end

      it 'returns all records without scope' do
        expect(Assessment.all).to include(assessment1, assessment2)
      end

      it 'raises error when trying to create without tenant_id' do
        assessment = Assessment.new(name: 'Test Assessment', time_limit_min: 30, created_by: 1)
        expect { assessment.valid? }.to raise_error(RuntimeError, /please set Current\.tenant_id/)
      end
    end
  end
end
