# frozen_string_literal: true

# Snapshots vacancy_id/assessment_id/vacancy_version_id/threshold from its parent
# CvScreening at upload time — immutable afterward (no updated_at). This is what
# lets a batch keep scoring against the vacancy state it was uploaded against, even
# if the vacancy (or the screening's own threshold) is edited later.
class CvScreeningBatch < ApplicationRecord
  include TenantScoped

  # 'held' = every auto-decided entry in the batch landed on the same outcome
  # (FR5's confirm-before-firing gate) — notification emails are queued but not
  # sent until a recruiter explicitly confirms via CvScreeningBatchesController#confirm.
  NOTIFICATION_STATUSES = %w[pending held released].freeze

  belongs_to :cv_screening
  belongs_to :vacancy
  belongs_to :assessment
  belongs_to :vacancy_version, optional: true
  has_many :cv_screening_entries, dependent: :destroy

  validates :notification_status, inclusion: { in: NOTIFICATION_STATUSES }

  def held_for_confirmation? = notification_status == 'held'
end
