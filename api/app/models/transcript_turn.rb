# frozen_string_literal: true

class TranscriptTurn < ApplicationRecord
    SPEAKERS = %w[ai candidate].freeze

    belongs_to :session

    validates :turn_number, presence: true,
                            numericality: { only_integer: true, greater_than: 0 }

    validates :speaker, inclusion: { in: SPEAKERS }
    validates :text, presence: true

    scope :ordered, -> { order(:turn_number) }

    after_commit :invalidate_cache

    CACHE_VERSION_KEY = 'transcript:index:version'

    def self.cache_version
        Rails.cache.fetch(CACHE_VERSION_KEY) { SecureRandom.uuid }
    end

    def invalidate_cache
        Rails.cache.write(CACHE_VERSION_KEY, SecureRandom.uuid)
        Rails.cache.delete([cache_key, id])
    end
end
