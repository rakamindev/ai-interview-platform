# frozen_string_literal: true

class Portfolio < ApplicationRecord
  GENERATION_STATUSES = %w[pending generating complete failed].freeze
  CONTEXT_STATUSES    = %w[relevant empty_transcript out_of_context].freeze

  belongs_to :session
  has_many :portfolio_skills, dependent: :destroy
  has_many :fit_gap_reports, dependent: :destroy
  has_many :assessor_overrides, through: :portfolio_skills

  validates :generation_status, inclusion: { in: GENERATION_STATUSES }
  validates :context_status, inclusion: { in: CONTEXT_STATUSES }

  scope :complete,    -> { where(generation_status: 'complete') }
  scope :failed,      -> { where(generation_status: 'failed') }
  scope :generating,  -> { where(generation_status: 'generating') }

  def complete?          = generation_status == 'complete'
  def generating?        = generation_status == 'generating'
  def failed?            = generation_status == 'failed'
  def empty_transcript?  = context_status == 'empty_transcript'
  def out_of_context?    = context_status == 'out_of_context'
end
