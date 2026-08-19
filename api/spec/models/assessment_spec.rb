# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Assessment, type: :model do
  let(:org) { create(:organization) }

  describe 'skill requirement validation' do
    it 'rejects an assessment with zero skills' do
      assessment = build(:assessment, tenant: org)
      expect(assessment).not_to be_valid
      expect(assessment.errors[:base]).to include('must include at least one skill')
    end

    it 'accepts an assessment with at least one skill' do
      assessment = build(:assessment, :with_skill, tenant: org)
      expect(assessment).to be_valid
    end

    it 'rejects an assessment whose only skill is marked for destruction' do
      assessment = build(:assessment, :with_skill, tenant: org)
      assessment.assessment_skills.first.mark_for_destruction
      expect(assessment).not_to be_valid
    end
  end
end
