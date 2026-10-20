# frozen_string_literal: true

class VacancySkill < ApplicationRecord
  belongs_to :vacancy

  scope :custom,   -> { where(is_custom: true) }
  scope :standard, -> { where(is_custom: false) }

  before_validation :infer_custom_status

  validates :skill_label, presence: true
  validates :expected_level, numericality: { only_integer: true, in: 1..5 }
  validates :skill_id, presence: true, unless: :is_custom?

  def custom?
    is_custom?
  end

  private

  def infer_custom_status
    self.is_custom = true if skill_id.blank?
  end
end
