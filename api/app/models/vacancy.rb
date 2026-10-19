# frozen_string_literal: true

class Vacancy < ApplicationRecord
  include TenantScoped

  has_many :vacancy_skills
  has_many :fit_gap_reports

  validates :role_title, presence: true

  scope :active, -> { where(archived_at: nil) }

  def archive
    # Archiving does not change requirements, so leave updated_at unchanged for report freshness.
    update_column(:archived_at, Time.current)
  end

  accepts_nested_attributes_for :vacancy_skills,
                                 allow_destroy: true,
                                 reject_if: :all_blank
end
