# frozen_string_literal: true

class VacancySkill < ApplicationRecord
    belongs_to :vacancy
    belongs_to :skill_taxonomy

    validates :expected_level, numericality: { only_integer: true, in: 1..5 }

    default_scope { includes(:skill_taxonomy) }

    CACHE_VERSION_KEY = 'vacancy-skill:index:version'

    def self.cache_version
        Rails.cache.fetch(CACHE_VERSION_KEY) { SecureRandom.uuid }
    end

    def self.invalidate_cache
        Rails.cache.write(CACHE_VERSION_KEY, SecureRandom.uuid)
        Rails.cache.delete([cache_key, id])
    end
end
