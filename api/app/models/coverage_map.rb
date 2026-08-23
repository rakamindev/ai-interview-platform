# frozen_string_literal: true

class CoverageMap < ApplicationRecord
    STATES = %w[not_yet initiated partial covered].freeze

    belongs_to :session
    belongs_to :skill_taxonomy

    # validates :skill_label, presence: true
    validates :state, inclusion: { in: STATES }
    validates :probe_count, numericality: { only_integer: true, greater_than_or_equal_to: 0 }

    scope :configured, -> { where(is_discovered: false) }
    scope :discovered, -> { where(is_discovered: true) }
    default_scope { includes(:skill_taxonomy) }
end
