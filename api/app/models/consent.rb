# frozen_string_literal: true

# A candidate's consent to the interview disclosure for a given session.
# One row per session (unique) — re-granting updates the existing row in place,
# so there is never more than one consent record per session.
class Consent < ApplicationRecord
  include TenantScoped

  CURRENT_VERSION = '2026-08-17'

  STATUSES = %w[granted revoked].freeze

  belongs_to :session

  validates :session_id, uniqueness: true
  validates :version, presence: true
  validates :status, inclusion: { in: STATUSES }
  validates :granted_at, presence: true

  scope :granted, -> { where(status: 'granted') }

  def granted? = status == 'granted'
  def revoked? = status == 'revoked'
end