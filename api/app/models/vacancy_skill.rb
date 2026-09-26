# frozen_string_literal: true

class VacancySkill < ApplicationRecord
  belongs_to :vacancy

  validates :skill_label, presence: true,
                          uniqueness: { scope: :vacancy_id, case_sensitive: false, message: 'has already been added to this vacancy' }
  validates :expected_level, numericality: { only_integer: true, in: 1..5 }
end
