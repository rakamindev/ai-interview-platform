# frozen_string_literal: true

class Assessment < ApplicationRecord
  include TenantScoped

  has_many :assessment_skills, dependent: :destroy, inverse_of: :assessment
  has_many :assessment_versions, dependent: :restrict_with_error
  has_many :sessions, dependent: :restrict_with_error

  SUPPORTED_LANGUAGES = { 'en' => 'English', 'id' => 'Bahasa Indonesia' }.freeze

  validates :name, presence: true
  validates :time_limit_min, presence: true,
                              inclusion: { in: [10, 30, 45, 60, 90] }
  validates :language, inclusion: { in: SUPPORTED_LANGUAGES.keys }, allow_nil: true
  validates :rubric_version, numericality: { only_integer: true, greater_than: 0 }

  accepts_nested_attributes_for :assessment_skills,
                                 allow_destroy: true,
                                 reject_if: :all_blank

  def rubric_skills
    assessment_skills
  end
end
