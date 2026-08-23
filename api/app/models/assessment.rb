# frozen_string_literal: true

class Assessment < ApplicationRecord
    include TenantScoped

    has_many :assessment_skills, dependent: :destroy, inverse_of: :assessment
    alias_attribute :skills, :assessment_skills
    has_many :sessions, dependent: :restrict_with_error
    validates :vacancy_id, uniqueness: true
    belongs_to :vacancy

    SUPPORTED_LANGUAGES = { 'en' => 'English', 'id' => 'Bahasa Indonesia' }.freeze
    CACHE_VERSION_KEY = 'assessment:index:version'

    # validates :name, presence: true
    validates :time_limit_min, presence: true,
                               inclusion: { in: [10, 30, 45, 60, 90] }
    validates :language, inclusion: { in: SUPPORTED_LANGUAGES.keys }, allow_nil: true

    accepts_nested_attributes_for :assessment_skills,
                                  allow_destroy: true,
                                  reject_if: :all_blank

    after_commit :invalidate_cache

    def self.cache_version
        Rails.cache.fetch(CACHE_VERSION_KEY) { SecureRandom.uuid }
    end

    def invalidate_cache
        Rails.cache.write(CACHE_VERSION_KEY, SecureRandom.uuid)
        Rails.cache.delete([cache_key, id])
    end

    def name
        vacancy.role_title
    end
end
