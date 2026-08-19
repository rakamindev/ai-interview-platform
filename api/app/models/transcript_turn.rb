# frozen_string_literal: true

class TranscriptTurn < ApplicationRecord
  SPEAKERS = %w[ai candidate].freeze

  belongs_to :session

  validates :turn_number, presence: true,
                          numericality: { only_integer: true, greater_than: 0 }
  validates :speaker, inclusion: { in: SPEAKERS }
  validates :text, presence: true

  scope :ordered, -> { order(:turn_number) }
end
