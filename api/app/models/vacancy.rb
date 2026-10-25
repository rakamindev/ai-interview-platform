# frozen_string_literal: true

class Vacancy < ApplicationRecord
  include TenantScoped

  has_many :vacancy_skills, dependent: :destroy
  has_many :fit_gap_reports, dependent: :destroy

  validates :role_title, presence: true
  validates :role_title, uniqueness: {
    scope: :tenant_id,
    case_sensitive: false,
    message: "already exists"
  }

  before_validation :normalize_role_title

  accepts_nested_attributes_for :vacancy_skills,
                                 allow_destroy: true,
                                 reject_if: :all_blank

  private

  def normalize_role_title
    self.role_title = role_title.to_s.strip.squeeze(" ")
  end
end
