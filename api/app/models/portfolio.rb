# frozen_string_literal: true

class Portfolio < ApplicationRecord
  include TenantScoped

  GENERATION_STATUSES = %w[pending generating complete failed].freeze

  belongs_to :session
  has_many :portfolio_skills, dependent: :destroy
  has_many :assessor_overrides, through: :portfolio_skills
  has_many :fit_gap_reports, dependent: :destroy

  validates :generation_status, inclusion: { in: GENERATION_STATUSES }

  scope :complete,    -> { where(generation_status: 'complete') }
  scope :failed,      -> { where(generation_status: 'failed') }
  scope :generating,  -> { where(generation_status: 'generating') }

  def complete?    = generation_status == 'complete'
  def generating?  = generation_status == 'generating'
  def failed?      = generation_status == 'failed'

  private

  # Portfolios are created by a background job operating on an already
  # tenant-scoped session (no request context, so Current.tenant_id isn't
  # set) — inherit tenant_id from the parent session instead.
  #
  # Must be `=`, not `||=`: Rails pre-populates tenant_id on `.new` from the
  # active default_scope's equality condition (where(tenant_id: Current.tenant_id))
  # before this callback runs, so `||=` would silently keep that (possibly
  # wrong/absent) value instead of deriving it from the real parent.
  def assign_tenant_id
    self.tenant_id = session&.tenant_id
  end
end
