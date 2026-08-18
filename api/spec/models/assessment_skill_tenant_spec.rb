# frozen_string_literal: true

require 'rails_helper'

RSpec.describe AssessmentSkill, type: :model do
  let(:assessment) { create(:assessment, tenant_id: 42) }

  it 'automatically copies tenant_id from assessment on create' do
    skill = create(:assessment_skill, assessment: assessment)
    expect(skill.tenant_id).to eq(42)
  end
end
