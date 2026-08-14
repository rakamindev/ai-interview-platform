# frozen_string_literal: true

require 'rails_helper'

RSpec.describe SkillTaxonomy, type: :model do
  it 'builds a valid record from the factory' do
    expect(build(:skill_taxonomy)).to be_valid
  end

  it 'persists to the ai_interview schema' do
    expect { create(:skill_taxonomy) }.to change(described_class, :count).by(1)
  end

  it 'requires a unique skill_id' do
    create(:skill_taxonomy, skill_id: 'SK-DUP-001')
    dup = build(:skill_taxonomy, skill_id: 'SK-DUP-001')

    expect(dup).not_to be_valid
    expect(dup.errors[:skill_id]).to be_present
  end

  it 'requires all five level anchors' do
    expect(build(:skill_taxonomy, l3_anchor: nil)).not_to be_valid
  end
end
