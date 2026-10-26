# frozen_string_literal: true

class Vacancy < ApplicationRecord
  include TenantScoped

  has_many :vacancy_skills, dependent: :destroy
  has_many :fit_gap_reports, dependent: :destroy

  validates :role_title, presence: true
  validates :location, length: { maximum: 255 }, allow_nil: true
  validates :minimum_education, length: { maximum: 100 }, allow_nil: true
  validates :experience_level, inclusion: { in: %w[intern associate mid senior lead] }, allow_nil: true
  validates :experience_years_min, numericality: { only_integer: true, greater_than_or_equal_to: 0 }, allow_nil: true
  validates :experience_years_max, numericality: { only_integer: true, greater_than_or_equal_to: 0 }, allow_nil: true
  validate :experience_years_range_is_valid
  validates :work_arrangement, inclusion: { in: %w[onsite hybrid remote] }, allow_nil: true
  validates :employment_type, inclusion: { in: %w[full_time contract internship] }, allow_nil: true
  validates :salary_min, numericality: { only_integer: true, greater_than_or_equal_to: 0 }, allow_nil: true
  validates :salary_max, numericality: { only_integer: true, greater_than_or_equal_to: 0 }, allow_nil: true
  validate :salary_min_must_not_exceed_max
  validate :role_title_must_fit_limit, if: :role_title_changed?
  validate :narrative_fields_must_fit_limit

  accepts_nested_attributes_for :vacancy_skills,
                                 allow_destroy: true,
                                 reject_if: :all_blank

  MAX_ROLE_TITLE_LENGTH = 100
  MAX_NARRATIVE_LENGTH = 500

  def salary_min_must_not_exceed_max
    return if salary_min.blank? || salary_max.blank? || salary_min <= salary_max

    errors.add(:salary_max, "must be greater than or equal to minimum salary")
  end

  def experience_years_range_is_valid
    return if experience_years_min.blank? || experience_years_max.blank? || experience_years_min <= experience_years_max

    errors.add(:experience_years_max, "must be greater than or equal to minimum experience")
  end

  private

  def role_title_must_fit_limit
    return if role_title.blank? || role_title.length <= MAX_ROLE_TITLE_LENGTH

    errors.add(:role_title, "must be 100 characters or fewer")
  end

  def narrative_fields_must_fit_limit
    { culture_dimensions: culture_dimensions, competency_expectations: competency_expectations }.each do |field, value|
      next unless will_save_change_to_attribute?(field)
      next if value.blank? || value.length <= MAX_NARRATIVE_LENGTH

      errors.add(field, "must be 500 characters or fewer")
    end
  end
end
