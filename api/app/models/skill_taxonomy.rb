# frozen_string_literal: true

class SkillTaxonomy < ApplicationRecord
    has_many :vacancy_skills, dependent: :destroy
    has_many :assessment_skills
    has_many :vacancies, through: :vacancy_skills
    has_many :coverage_maps
    has_many :portfolio_skills

    validates :skill_id, presence: true, uniqueness: true, length: { maximum: 50 }
    validates :skill_label, presence: true, length: { maximum: 255 }
    validates :category, presence: true, length: { maximum: 50 }
    validates :l1_anchor, presence: true
    validates :l2_anchor, presence: true
    validates :l3_anchor, presence: true
    validates :l4_anchor, presence: true
    validates :l5_anchor, presence: true

    CATEGORIES = %w[engineering soft_skills product_process].freeze

    CACHE_VERSION_KEY = 'skill-taxonomy:index:version'

    def self.invalidate_cache
        Rails.cache.write(CACHE_VERSION_KEY, SecureRandom.uuid)
        Rails.cache.delete([cache_key, id])
    end

    def self.cache_version
        Rails.cache.fetch(CACHE_VERSION_KEY) { SecureRandom.uuid }
    end
end
