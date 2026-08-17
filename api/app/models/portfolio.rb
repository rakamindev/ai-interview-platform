# frozen_string_literal: true

class Portfolio < ApplicationRecord
  GENERATION_STATUSES = %w[pending generating complete failed].freeze
  VERDICTS = %w[pass consider failed].freeze

  belongs_to :session
  has_many :portfolio_skills, dependent: :destroy
  has_many :assessor_overrides, through: :portfolio_skills

  validates :generation_status, inclusion: { in: GENERATION_STATUSES }
  validates :verdict, inclusion: { in: VERDICTS }, allow_nil: true

  scope :complete,    -> { where(generation_status: 'complete') }
  scope :failed,      -> { where(generation_status: 'failed') }
  scope :generating,  -> { where(generation_status: 'generating') }

  def complete?    = generation_status == 'complete'
  def generating?  = generation_status == 'generating'
  def failed?      = generation_status == 'failed'

  # Recomputes and persists the candidate verdict from current skill levels
  # (AI rating, or the assessor override when one exists). Called whenever
  # skill data changes: after generation and after any override.
  def recompute_verdict!
    levels = portfolio_skills.filter_map do |skill|
      override = skill.assessor_override
      override ? override.override_level : skill.ai_level
    end

    new_verdict =
      if levels.empty?
        nil
      else
        average = levels.sum.to_f / levels.size
        if average >= 4.0
          'pass'
        elsif average >= 2.5
          'consider'
        else
          'failed'
        end
      end

    update_column(:verdict, new_verdict) if new_verdict != verdict
  end
end
