# frozen_string_literal: true

class Portfolio < ApplicationRecord
  GENERATION_STATUSES = %w[pending generating complete failed].freeze

  belongs_to :session
  has_many :portfolio_skills, dependent: :destroy
  has_many :assessor_overrides, through: :portfolio_skills
  has_one  :hiring_decision, dependent: :destroy
  # Without this a candidate cannot be deleted once a fit/gap report exists:
  # the FK on fit_gap_reports blocks it and the failure surfaces as a raw
  # PG::ForeignKeyViolation. A record about a person has to be removable.
  has_many :fit_gap_reports, dependent: :destroy

  validates :generation_status, inclusion: { in: GENERATION_STATUSES }

  scope :complete,    -> { where(generation_status: 'complete') }
  scope :failed,      -> { where(generation_status: 'failed') }
  scope :generating,  -> { where(generation_status: 'generating') }

  def complete?    = generation_status == 'complete'
  def generating?  = generation_status == 'generating'
  def failed?      = generation_status == 'failed'
end
