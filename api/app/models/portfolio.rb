# frozen_string_literal: true

class Portfolio < ApplicationRecord
  include TenantScoped

  GENERATION_STATUSES = %w[pending generating complete failed].freeze

  belongs_to :session
  has_many :portfolio_skills, dependent: :destroy
  has_many :assessor_overrides, through: :portfolio_skills
  has_many :fit_gap_reports, dependent: :destroy

  validates :generation_status, inclusion: { in: GENERATION_STATUSES }

  scope :complete,   -> { where(generation_status: 'complete') }
  scope :failed,     -> { where(generation_status: 'failed') }
  scope :generating, -> { where(generation_status: 'generating') }

  def complete?    = generation_status == 'complete'
  def generating?  = generation_status == 'generating'
  def failed?      = generation_status == 'failed'

  private

  # TenantScoped stamps Current.tenant_id on create; in Sidekiq workers there
  # is no request tenant, so fall back to the owning session's tenant.
  def assign_tenant_id
    self.tenant_id ||= Current.tenant_id if RequestStore.store.key?(:tenant_id)
    self.tenant_id ||= session&.tenant_id
  end
end
