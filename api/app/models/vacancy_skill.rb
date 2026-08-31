# frozen_string_literal: true

class VacancySkill < ApplicationRecord
  belongs_to :vacancy

  validates :skill_label, presence: true
  validates :expected_level, numericality: { only_integer: true, in: 1..5 }

  before_validation :lookup_skill_id

  private

  def lookup_skill_id
    return if skill_label.blank?

    taxonomy = SkillTaxonomy.find_by(skill_label: skill_label)
    self.skill_id = taxonomy&.skill_id
  end
end
