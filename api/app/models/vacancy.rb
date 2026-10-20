# frozen_string_literal: true

class Vacancy < ApplicationRecord
  include TenantScoped

  has_many :vacancy_skills, dependent: :destroy
  has_many :fit_gap_reports, dependent: :destroy

  validates :role_title, presence: true, length: { maximum: 255 }
  validates :culture_dimensions, length: { maximum: 5000 }, allow_nil: true
  validates :competency_expectations, length: { maximum: 5000 }, allow_nil: true

  accepts_nested_attributes_for :vacancy_skills,
                                 allow_destroy: true,
                                 reject_if: :all_blank
end
