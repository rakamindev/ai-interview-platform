# frozen_string_literal: true

class Portfolio < ApplicationRecord
  GENERATION_STATUSES = %w[pending generating complete failed].freeze

  # What the assessor is told when generation fails (AC-10, AC-21). The raw error can quote the model's
  # answer, which can quote the candidate, so it's never stored, sent or logged.
  GENERATION_ERROR_MESSAGES = {
    'model_timeout'          => "Model timeout: the AI didn't answer in time.",
    'model_unavailable'      => 'The AI model was unavailable or rate-limited.',
    'model_invalid_response' => "The AI's answer couldn't be read as a portfolio.",
    'internal_error'         => 'Something went wrong while saving the portfolio.'
  }.freeze
  GENERIC_GENERATION_ERROR = 'Generating the portfolio failed.'

  belongs_to :session
  has_many :portfolio_skills, dependent: :destroy
  has_many :assessor_overrides, through: :portfolio_skills

  validates :generation_status, inclusion: { in: GENERATION_STATUSES }

  # Portfolios have no tenant_id: they belong to a tenant through their session. Every request-time lookup goes
  # through this scope (Step 3, P0-2). Current.tenant_id raises when no tenant is set, so it fails closed.
  scope :for_current_tenant, -> { joins(:session).where(sessions: { tenant_id: Current.tenant_id }) }

  scope :complete,    -> { where(generation_status: 'complete') }
  scope :failed,      -> { where(generation_status: 'failed') }
  scope :generating,  -> { where(generation_status: 'generating') }

  def complete?    = generation_status == 'complete'
  def generating?  = generation_status == 'generating'
  def failed?      = generation_status == 'failed'

  def self.generation_error_message(category) = GENERATION_ERROR_MESSAGES.fetch(category.to_s, GENERIC_GENERATION_ERROR)

  # Safe to show: derived from the category, so a failure stored before categories existed shows the generic text.
  def safe_generation_error
    failed? ? self.class.generation_error_message(generation_error_category) : nil
  end
end
