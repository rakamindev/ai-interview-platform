# frozen_string_literal: true

require 'rails_helper'

# The shared skill library assessors pick from when they build an assessment.
RSpec.describe SkillTaxonomy do
  def build_skill(**attrs)
    described_class.new({ skill_id: 'SK-ENG-001', skill_label: 'React', category: 'engineering',
                          l1_anchor: 'a', l2_anchor: 'b', l3_anchor: 'c', l4_anchor: 'd', l5_anchor: 'e' }.merge(attrs))
  end

  it 'is valid with an id, a label, a category and all five level anchors' do
    expect(build_skill).to be_valid
  end

  it 'requires the id, label, category and every level anchor' do
    %i[skill_id skill_label category l1_anchor l2_anchor l3_anchor l4_anchor l5_anchor].each do |attr|
      expect(build_skill(attr => '')).not_to be_valid, "#{attr} should be required"
    end
  end

  it 'keeps skill ids unique' do
    build_skill.save!

    duplicate = build_skill(skill_label: 'React (copy)')

    expect(duplicate).not_to be_valid
    expect(duplicate.errors[:skill_id]).to be_present
  end

  it 'limits the id, label and category to their column lengths' do
    expect(build_skill(skill_id: 'x' * 51)).not_to be_valid
    expect(build_skill(skill_label: 'x' * 256)).not_to be_valid
    expect(build_skill(category: 'x' * 51)).not_to be_valid
  end

  # CATEGORIES lists the three groups the skill picker shows, but nothing enforces it.
  it 'accepts a category outside CATEGORIES (not validated today)' do
    expect(described_class::CATEGORIES).to eq(%w[engineering soft_skills product_process])
    expect(build_skill(category: 'marketing')).to be_valid
  end
end
