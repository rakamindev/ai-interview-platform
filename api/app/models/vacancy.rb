# frozen_string_literal: true

class Vacancy < ApplicationRecord
  include TenantScoped

  STATUSES = %w[active closed].freeze

  has_many :vacancy_skills
  has_many :fit_gap_reports

  validates :role_title, presence: true
  validates :status, inclusion: { in: STATUSES }

  scope :unarchived, -> { where(archived_at: nil) }
  scope :active, -> { where(archived_at: nil, status: 'active') }

  def update_status(next_status)
    self.status = next_status
    return false unless valid?

    # Status does not affect Fit/Gap requirements, so keep historical reports fresh.
    update_column(:status, next_status)
  end

  def archive
    # Archiving does not change requirements, so leave updated_at unchanged for report freshness.
    update_column(:archived_at, Time.current)
  end

  accepts_nested_attributes_for :vacancy_skills,
                                 allow_destroy: true,
                                 reject_if: :all_blank
end
