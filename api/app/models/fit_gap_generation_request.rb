# frozen_string_literal: true

class FitGapGenerationRequest < ApplicationRecord
  STATUSES = %w[queued running succeeded failed].freeze

  belongs_to :portfolio
  belongs_to :vacancy

  validates :status, inclusion: { in: STATUSES }
  validates :request_token, :source_digest, presence: true
end
