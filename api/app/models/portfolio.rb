# frozen_string_literal: true

class Portfolio < ApplicationRecord
  STATUSES = %w[pending generating complete failed].freeze

  belongs_to :session
  has_many   :portfolio_skills, dependent: :destroy
  has_many   :fit_gap_reports,  dependent: :destroy

  #cari lookups lewat session to enforce batasan akses
  scope :for_tenant, ->(tenant_id) {
    joins(:session).where(sessions: { tenant_id: tenant_id })
  }

  validates :generation_status, inclusion: { in: STATUSES }

  def complete?
    generation_status == 'complete'
  end

  def generating?
    generation_status == 'generating'
  end

  def pending?
    generation_status == 'pending'
  end

  def failed?
    generation_status == 'failed'
  end
end
