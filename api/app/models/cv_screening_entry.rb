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

  def pending?       = decision == 'pending'
  def needs_review?  = decision == 'needs_review'
  def invited?       = decision == 'invited'
  def not_advanced?  = decision == 'not_advanced'

  def notified? = notified_at.present?
end
