# frozen_string_literal: true

class Assessment < ApplicationRecord
  include TenantScoped

  has_many :assessment_skills, dependent: :destroy, inverse_of: :assessment
  has_many :sessions, dependent: :restrict_with_error

  SUPPORTED_LANGUAGES = { 'en' => 'English', 'id' => 'Bahasa Indonesia' }.freeze

  validates :name, presence: true
  validates :time_limit_min, presence: true,
                              inclusion: { in: [10, 30, 45, 60, 90] }
  validates :language, inclusion: { in: SUPPORTED_LANGUAGES.keys }, allow_nil: true

  accepts_nested_attributes_for :assessment_skills,
                                 allow_destroy: true,
                                 reject_if: :all_blank

  validate :at_least_one_skill

  private

  # An assessment with zero skills produces an empty agenda and an unusable
  # interview (the AI has nothing to probe, the coverage map is empty). Refuse
  # to save it at the model layer — the UI must require at least one skill.
  def at_least_one_skill
    remaining = assessment_skills.reject(&:marked_for_destruction?)
    errors.add(:base, 'must include at least one skill') if remaining.empty?
  end
end
