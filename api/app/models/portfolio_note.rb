# frozen_string_literal: true

class PortfolioNote < ApplicationRecord
  CATEGORIES = %w[review evidence follow_up].freeze

  belongs_to :portfolio

  validates :body, presence: true, length: { maximum: 5_000 }
  validates :category, inclusion: { in: CATEGORIES }
  validates :created_by, presence: true
end
