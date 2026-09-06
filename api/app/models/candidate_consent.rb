# frozen_string_literal: true

class CandidateConsent < ApplicationRecord
  DISCLOSURE_VERSION = '1.0'
  STATUSES = %w[pending granted revoked].freeze

  belongs_to :session

  validates :status, inclusion: { in: STATUSES }
  validates :session_id, uniqueness: { message: 'sudah memiliki consent record' }

  def granted?
    status == 'granted'
  end

  def revoked?
    status == 'revoked'
  end
end
