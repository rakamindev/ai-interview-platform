class Portfolio < ApplicationRecord
  include TenantScoped

   GENERATION_STATUSES = %w[pending generating complete failed].freeze

   belongs_to :session
   has_many :portfolio_skills, dependent: :destroy
   has_many :assessor_overrides, through: :portfolio_skills

   validates :generation_status, inclusion: { in: GENERATION_STATUSES }

   scope :complete,    -> { where(generation_status: 'complete') }
   scope :failed,      -> { where(generation_status: 'failed') }
   scope :generating,  -> { where(generation_status: 'generating') }

   def complete?    = generation_status == 'complete'
   def generating?  = generation_status == 'generating'
   def failed?      = generation_status == 'failed'

  private

  # Portfolios are created from Sidekiq workers (Portfolios::Generator) and
  # from Sessions::EndHandler, which may run outside a normal HTTP request —
  # there is no reliable Current.tenant_id in those contexts. A portfolio's
  # tenant is unambiguous anyway: it's whatever tenant its session belongs
  # to. Override TenantScoped's default (which reads Current.tenant_id) to
  # derive it from the parent session instead.
  def assign_tenant_id
    self.tenant_id ||= session&.tenant_id
  end
 end