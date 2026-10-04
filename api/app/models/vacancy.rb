# frozen_string_literal: true

class Vacancy < ApplicationRecord
  include TenantScoped

  has_many :vacancy_skills, dependent: :destroy
  has_many :fit_gap_reports, dependent: :destroy

  validates :role_title, presence: true
  validates :culture_dimensions, presence: true
  validates :competency_expectations, presence: true
  validate :must_have_at_least_one_skill

  accepts_nested_attributes_for :vacancy_skills,
                                 allow_destroy: true,
                                 reject_if: :all_blank

  private

  def must_have_at_least_one_skill
    errors.add(:vacancy_skills, "must have at least one skill") if vacancy_skills.reject(&:marked_for_destruction?).empty?
  end
end