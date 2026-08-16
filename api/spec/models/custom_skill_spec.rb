# frozen_string_literal: true

require 'rails_helper'

RSpec.describe CustomSkill, type: :model do
  it 'rejects a duplicate label within the same tenant' do
    org = create(:organization)
    create(:custom_skill, tenant_id: org.id, skill_label: 'Data Analysis')

    duplicate = build(:custom_skill, tenant_id: org.id, skill_label: 'Data Analysis')

    expect(duplicate).not_to be_valid
    expect(duplicate.errors[:skill_label]).to be_present
  end

  it 'allows the same label across tenants' do
    first  = create(:organization)
    second = create(:organization)
    create(:custom_skill, tenant_id: first.id, skill_label: 'Data Analysis')

    expect(build(:custom_skill, tenant_id: second.id, skill_label: 'Data Analysis')).to be_valid
  end

  it 'requires the level anchors' do
    skill = build(:custom_skill, l1_anchor: nil)

    expect(skill).not_to be_valid
    expect(skill.errors[:l1_anchor]).to be_present
  end
end
