# frozen_string_literal: true

# Records a candidate's explicit consent (or refusal) to data processing before
# an interview starts — required by Indonesia's Personal Data Protection Law
# (UU PDP, Law No. 27/2022, Art. 5, 19-20).
#
# One record per session (unique index on session_id). Re-submitting consent is
# idempotent: the same record is updated, and a candidate may change their mind
# (declined → accepted and vice versa) while the session is still open.
class CandidateConsent < ApplicationRecord
  STATUSES = %w[pending accepted declined].freeze

  belongs_to :session

  validates :status, inclusion: { in: STATUSES }
  validates :policy_version, presence: true

  scope :accepted, -> { where(status: 'accepted') }

  def accepted? = status == 'accepted'
  def declined? = status == 'declined'
  def pending?  = status == 'pending'
end
