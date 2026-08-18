# frozen_string_literal: true

class SkillTaxonomy < ApplicationRecord
  validates :skill_id,    presence: true, uniqueness: true, length: { maximum: 50 }
  validates :skill_label, presence: true, length: { maximum: 255 }
  validates :category,    presence: true, length: { maximum: 50 }
  validates :l1_anchor,   presence: true
  validates :l2_anchor,   presence: true
  validates :l3_anchor,   presence: true
  validates :l4_anchor,   presence: true
  validates :l5_anchor,   presence: true

  CATEGORIES = %w[engineering soft_skills product_process].freeze
end
