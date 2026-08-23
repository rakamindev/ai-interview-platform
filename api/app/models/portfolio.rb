# frozen_string_literal: true

class Portfolio < ApplicationRecord
    GENERATION_STATUSES = %w[pending generating complete failed].freeze

    belongs_to :session
    has_many :portfolio_skills, dependent: :destroy
    has_many :assessor_overrides, through: :portfolio_skills

    validates :generation_status, inclusion: { in: GENERATION_STATUSES }

    after_commit :invalidate_cache

    scope :complete, -> { where(generation_status: 'complete') }
    scope :failed, -> { where(generation_status: 'failed') }
    scope :generating, -> { where(generation_status: 'generating') }

    CACHE_VERSION_KEY = 'portfolio:index:version'

    def self.cache_version
        Rails.cache.fetch(CACHE_VERSION_KEY) { SecureRandom.uuid }
    end

    def self.invalidate_cache
        Rails.cache.write(CACHE_VERSION_KEY, SecureRandom.uuid)
    end

    def invalidate_cache
        self.class.invalidate_cache
        Rails.cache.delete([cache_key, id])
    end

    def complete? = generation_status == 'complete'

    def generating? = generation_status == 'generating'

    def failed? = generation_status == 'failed'
end
