# frozen_string_literal: true

class VacancySkill < ApplicationRecord
  belongs_to :vacancy

  validates :skill_label, presence: true
  validates :expected_level, numericality: { only_integer: true, in: 1..5 }
  validate :unique_skill_label_within_vacancy

  private

  def unique_skill_label_within_vacancy
    return unless vacancy && skill_label.present?

    siblings = vacancy.vacancy_skills.reject(&:marked_for_destruction?)
    duplicates = siblings.select { |s| s.skill_label.casecmp?(skill_label) && s != self }
    if duplicates.any?
      errors.add(:skill_label, "is already added to this vacancy")
    end
  end
end
