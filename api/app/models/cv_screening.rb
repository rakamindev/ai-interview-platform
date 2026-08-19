# frozen_string_literal: true

class CvScreening < ApplicationRecord
  include TenantScoped

  belongs_to :vacancy
  belongs_to :assessment
  has_many :cv_screening_batches, dependent: :destroy
  has_many :cv_screening_entries, through: :cv_screening_batches

  validates :name, presence: true
  validates :threshold, numericality: { only_integer: true, in: 0..100 }, allow_nil: true
  validate :vacancy_has_public_requirement_text

  private

  # Blocks a screening from ever pointing at a vacancy with nothing to tell a
  # rejected candidate — auto-reject feedback (Phase 7) reads only this field.
  def vacancy_has_public_requirement_text
    return if vacancy.nil? # presence-validated separately by belongs_to
    return if vacancy.public_requirement_text.present?

    errors.add(:vacancy, 'must have public requirement text before it can be screened')
  end
end
