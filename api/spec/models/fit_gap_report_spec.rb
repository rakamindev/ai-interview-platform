# frozen_string_literal: true

require 'rails_helper'

RSpec.describe FitGapReport, type: :model do
  let(:org) { set_current_tenant }
  let(:assessment) { create(:assessment, tenant_id: org.id) }
  let(:session) { create(:session, assessment: assessment, tenant_id: org.id) }
  let(:portfolio) { create(:portfolio, session: session) }
  let(:vacancy) { create(:vacancy, tenant_id: org.id) }

  describe 'validations and associations' do
    it 'is valid with valid attributes' do
      report = build(:fit_gap_report, portfolio: portfolio, vacancy: vacancy)
      expect(report).to be_valid
    end

    it 'is invalid without skill_comparisons' do
      report = build(:fit_gap_report, portfolio: portfolio, vacancy: vacancy, skill_comparisons: nil)
      expect(report).not_to be_valid
      expect(report.errors[:skill_comparisons]).to include("can't be blank")
    end
  end
end
