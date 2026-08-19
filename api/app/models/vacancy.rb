# frozen_string_literal: true

class Vacancy < ApplicationRecord
  include TenantScoped

  has_many :vacancy_skills, dependent: :destroy
  has_many :fit_gap_reports, dependent: :destroy

  validates :role_title, presence: true

  accepts_nested_attributes_for :vacancy_skills,
                                allow_destroy: true,
                                reject_if: :all_blank
end
