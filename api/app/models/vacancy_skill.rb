# frozen_string_literal: true

class VacancySkill < ApplicationRecord
  belongs_to :vacancy

  validates :skill_label, presence: true,
                          uniqueness: { scope: :vacancy_id,
                                        message: 'has already been added to this vacancy' }
  validates :expected_level, numericality: { only_integer: true, in: 1..5 }

  # Same in-memory guard as AssessmentSkill — nested batch duplicates must be
  # a clean 422, not a 500 from the unique index. Never touches the association
  # cache (see AssessmentSkill#no_duplicate_skill_labels).
  validate :no_duplicate_skill_labels

  private

  def no_duplicate_skill_labels
    in_memory = vacancy.association(:vacancy_skills).target.filter_map(&:skill_label)
    persisted = vacancy.persisted? ? VacancySkill.where(vacancy_id: vacancy.id).pluck(:skill_label) : []
    labels = in_memory + persisted
    return if labels.size == labels.uniq.size

    errors.add(:skill_label, 'has already been added to this vacancy')
  end
end
