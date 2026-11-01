# frozen_string_literal: true

class Vacancy < ApplicationRecord
  include TenantScoped

  has_many :vacancy_skills, dependent: :destroy
  has_many :fit_gap_reports, dependent: :destroy

  before_validation :normalize_required_text

  validates :role_title, :culture_dimensions, :competency_expectations, presence: true
  validate :at_least_one_vacancy_skill

  accepts_nested_attributes_for :vacancy_skills,
                                 allow_destroy: true,
                                 reject_if: :all_blank

  private

  def normalize_required_text
    self.role_title = role_title&.strip
    self.culture_dimensions = culture_dimensions&.strip
    self.competency_expectations = competency_expectations&.strip
  end

  def at_least_one_vacancy_skill
    return if vacancy_skills.any? { |skill| !skill.marked_for_destruction? }

    errors.add(:vacancy_skills, 'must include at least one skill')
  end
end
