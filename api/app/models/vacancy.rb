# frozen_string_literal: true

class Vacancy < ApplicationRecord
  include TenantScoped

  has_many :vacancy_skills, dependent: :destroy
  has_many :fit_gap_reports, dependent: :destroy

  WORK_ARRANGEMENTS = %w[onsite hybrid remote].freeze
  EMPLOYMENT_TYPES   = %w[full_time part_time contract internship].freeze

  validates :role_title, presence: true
  validates :work_arrangement, inclusion: { in: WORK_ARRANGEMENTS }, allow_nil: true
  validates :employment_type, inclusion: { in: EMPLOYMENT_TYPES }, allow_nil: true

  accepts_nested_attributes_for :vacancy_skills,
                                 allow_destroy: true,
                                 reject_if: :all_blank

  def closed?
    application_deadline.present? && application_deadline.past?
  end
end
