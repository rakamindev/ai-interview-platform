# frozen_string_literal: true

# Snapshots vacancy_id/assessment_id/vacancy_version_id/threshold from its parent
# CvScreening at upload time — immutable afterward (no updated_at). This is what
# lets a batch keep scoring against the vacancy state it was uploaded against, even
# if the vacancy (or the screening's own threshold) is edited later.
class CvScreeningBatch < ApplicationRecord
  include TenantScoped

  # 'held' is no longer set by CvScreenings::BatchNotifier — auto-invite/auto-reject
  # always release notifications immediately once a batch finishes processing.
  # Kept in the allowed list only so any pre-existing 'held' row (from before
  # that change) remains valid; no code path can produce a new one.
  NOTIFICATION_STATUSES = %w[pending held released].freeze

  belongs_to :cv_screening
  belongs_to :vacancy
  belongs_to :assessment
  belongs_to :vacancy_version, optional: true
  has_many :cv_screening_entries, dependent: :destroy

  validates :notification_status, inclusion: { in: NOTIFICATION_STATUSES }
end
