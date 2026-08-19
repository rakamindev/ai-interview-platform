# frozen_string_literal: true

# One row per uploaded CV. Text extraction, email detection, gating, and scoring
# (Phase 6) populate additional columns and drive `decision` from 'pending' to its
# final state; this model only owns the data shape and the file attachment for now.
class CvScreeningEntry < ApplicationRecord
  include TenantScoped

  DECISIONS = %w[pending needs_review invited not_advanced].freeze

  belongs_to :cv_screening_batch
  belongs_to :session, optional: true
  has_one_attached :cv_file

  validates :decision, inclusion: { in: DECISIONS }

  # has_one_attached doesn't purge its blob on its own when the record is
  # destroyed (same reason RetentionSweep purges explicitly rather than
  # relying on that) — without this, cascading a CvScreening's destroy down
  # through its batches to this entry would drop the DB row but leave the
  # actual file behind in R2.
  before_destroy :purge_cv_file

  def pending?       = decision == 'pending'
  def needs_review?  = decision == 'needs_review'
  def invited?       = decision == 'invited'
  def not_advanced?  = decision == 'not_advanced'

  def notified? = notified_at.present?

  private

  def purge_cv_file
    cv_file.purge if cv_file.attached?
  end
end
