# frozen_string_literal: true

require 'rails_helper'

RSpec.describe FitGapGeneratorWorker, type: :worker do
  let!(:org_a) { Organization.create!(id: 260, scheme: 'org-a', name: 'Org A', identifier: 'org-a', host: 'localhost') }
  let!(:org_b) { Organization.create!(id: 261, scheme: 'org-b', name: 'Org B', identifier: 'org-b', host: 'localhost') }

  let!(:assessment_a) { Assessment.unscoped.create!(tenant_id: org_a.id, name: 'Assessment A', created_by: 1, time_limit_min: 30) }
  let!(:session_a) { Session.unscoped.create!(tenant_id: org_a.id, assessment_id: assessment_a.id, candidate_id: 860, status: 'ended') }
  let!(:portfolio_a) { session_a.create_portfolio!(candidate_id: session_a.candidate_id, generation_status: 'complete') }

  let!(:vacancy_a) { Vacancy.unscoped.create!(tenant_id: org_a.id, created_by: 1, role_title: 'Role A', culture_dimensions: 'A', competency_expectations: 'A') }
  let!(:vacancy_b) { Vacancy.unscoped.create!(tenant_id: org_b.id, created_by: 1, role_title: 'Role B', culture_dimensions: 'B', competency_expectations: 'B') }

  describe '#perform and Current context lifecycle' do
    it 'derives tenant_id from session and executes engine under Current context' do
      engine_double = instance_double(FitGap::Engine)
      expect(engine_double).to receive(:call) do
        expect(Current.tenant_id).to eq(org_a.id)
      end

      allow(FitGap::Engine).to receive(:new).with(portfolio: portfolio_a, vacancy: vacancy_a).and_return(engine_double)

      described_class.new.perform(portfolio_a.id, vacancy_a.id)
    end

    it 'restores pre-existing Current context after success' do
      RequestStore.store[:tenant_id] = 888

      allow_any_instance_of(FitGap::Engine).to receive(:call).and_return(nil)
      described_class.new.perform(portfolio_a.id, vacancy_a.id)

      expect(RequestStore.store[:tenant_id]).to eq(888)
    end

    it 'restores pre-existing Current context after exception' do
      RequestStore.store[:tenant_id] = 888

      allow_any_instance_of(FitGap::Engine).to receive(:call).and_raise(StandardError, 'FitGap error')
      expect {
        described_class.new.perform(portfolio_a.id, vacancy_a.id)
      }.to raise_error(StandardError, 'FitGap error')

      expect(RequestStore.store[:tenant_id]).to eq(888)
    end

    it 'aborts and does not call engine when portfolio and vacancy belong to different tenants' do
      expect(FitGap::Engine).not_to receive(:new)

      described_class.new.perform(portfolio_a.id, vacancy_b.id)
    end
  end
end
