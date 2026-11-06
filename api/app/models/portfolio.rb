# frozen_string_literal: true

class Portfolio < ApplicationRecord
  GENERATION_STATUSES = %w[pending generating complete failed].freeze

  belongs_to :session
  belongs_to :current_generation, class_name: 'PortfolioGeneration', optional: true
  has_many :generations, -> { order(:sequence) }, class_name: 'PortfolioGeneration', inverse_of: :portfolio
  # Skill rows from every generation, kept as history. Most callers want #portfolio_skills.
  has_many :all_portfolio_skills, class_name: 'PortfolioSkill', inverse_of: :portfolio
  # Overrides are listed across all generations so a correction attached to a skill that no longer
  # appears in the current generation stays visible instead of disappearing.
  has_many :assessor_overrides, through: :all_portfolio_skills

  validates :generation_status, inclusion: { in: GENERATION_STATUSES }

  before_destroy :release_generations

  scope :complete,    -> { where(generation_status: 'complete') }
  scope :failed,      -> { where(generation_status: 'failed') }
  scope :generating,  -> { where(generation_status: 'generating') }

  # Skills of the published generation only. Every reader (API JSON, fit/gap, PDF export) goes through
  # this, so history from older or superseded generations never leaks into what the assessor sees.
  def portfolio_skills
    return PortfolioSkill.none unless current_generation_id

    PortfolioSkill.where(portfolio_id: id, generation_id: current_generation_id)
  end

  def latest_generation
    generations.reorder(sequence: :desc).first
  end

  def complete?    = generation_status == 'complete'
  def generating?  = generation_status == 'generating'
  def failed?      = generation_status == 'failed'

  private

  def release_generations
    update_column(:current_generation_id, nil) if current_generation_id
    PortfolioSkill.where(portfolio_id: id).find_each(&:destroy!)
    PortfolioGeneration.where(portfolio_id: id).delete_all
  end
end
