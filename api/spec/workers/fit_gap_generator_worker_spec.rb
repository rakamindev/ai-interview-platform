# frozen_string_literal: true

require 'rails_helper'

RSpec.describe FitGapGeneratorWorker, type: :worker do
  let!(:org_a) { create(:organization, scheme: 'tenant-a') }
  let!(:org_b) { create(:organization, scheme: 'tenant-b') }

  let(:assessment_a) { create(:assessment, tenant_id: org_a.id) }
  let(:session_a) { create(:session, assessment: assessment_a, tenant_id: org_a.id) }
  let(:portfolio_a) { create(:portfolio, session: session_a) }
  let!(:skill_a) { create(:portfolio_skill, portfolio: portfolio_a, skill_id: 'sk-1', skill_label: 'Ruby', ai_level: 4) }

  let(:vacancy_a) { create(:vacancy, tenant_id: org_a.id) }
  let!(:vac_skill_a) { create(:vacancy_skill, vacancy: vacancy_a, skill_id: 'sk-1', skill_label: 'Ruby', expected_level: 3) }

  let(:vacancy_b) { create(:vacancy, tenant_id: org_b.id) }
  let!(:vac_skill_b) { create(:vacancy_skill, vacancy: vacancy_b, skill_id: 'sk-1', skill_label: 'Ruby', expected_level: 3) }

  describe '#perform' do
    it 'generates a FitGapReport when portfolio and vacancy belong to the same tenant' do
      allow_any_instance_of(FitGap::Engine).to receive(:default_gemini_client).and_return(nil)

      expect {
        described_class.new.perform(portfolio_a.id, vacancy_a.id)
      }.to change(FitGapReport, :count).by(1)

      report = FitGapReport.find_by(portfolio_id: portfolio_a.id, vacancy_id: vacancy_a.id)
      expect(report).to be_present
      expect(report.skill_comparisons.first['result']).to eq('exceed')
    end

    it 'enforces multi-tenant scoping and does not generate a report for a vacancy from another tenant' do
      allow_any_instance_of(FitGap::Engine).to receive(:default_gemini_client).and_return(nil)

      expect {
        described_class.new.perform(portfolio_a.id, vacancy_b.id)
      }.not_to change(FitGapReport, :count)
    end
  end
end
