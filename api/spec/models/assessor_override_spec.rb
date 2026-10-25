# frozen_string_literal: true

require 'rails_helper'

RSpec.describe AssessorOverride, type: :model do
  let(:org) { set_current_tenant }
  let(:assessment) { create(:assessment, tenant_id: org.id) }
  let(:session) { create(:session, assessment: assessment, tenant_id: org.id) }
  let(:portfolio) { create(:portfolio, session: session) }
  let(:skill) { create(:portfolio_skill, portfolio: portfolio, ai_level: 2) }

  describe 'validations' do
    it 'is valid with valid attributes' do
      override = build(:assessor_override, portfolio_skill: skill, ai_level: 2, override_level: 3)
      expect(override).to be_valid
    end

    it 'is invalid if override_level is outside 1..5 range' do
      expect(build(:assessor_override, portfolio_skill: skill, override_level: 0)).not_to be_valid
      expect(build(:assessor_override, portfolio_skill: skill, override_level: 6)).not_to be_valid
    end

    it 'is invalid without overridden_by' do
      override = build(:assessor_override, portfolio_skill: skill, overridden_by: nil)
      expect(override).not_to be_valid
      expect(override.errors[:overridden_by]).to include("can't be blank")
    end
  end
end
