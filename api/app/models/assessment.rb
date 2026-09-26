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

  validate :must_have_at_least_one_skill, on: :create
  validate :unique_assessment_skill_labels

  private

  def unique_assessment_skill_labels
    active_skills = assessment_skills.reject(&:marked_for_destruction?)
    labels = active_skills.map { |s| s.skill_label&.strip&.downcase }.compact.reject(&:blank?)
    duplicates = labels.select { |lbl| labels.count(lbl) > 1 }.uniq
    return if duplicates.empty?

    errors.add(:base, "Duplicate skill labels detected: #{duplicates.join(', ')}. Each skill to assess must be unique.")
  end

  def must_have_at_least_one_skill
    active_skills = assessment_skills.reject(&:marked_for_destruction?)
    errors.add(:base, 'Assessment must have at least one skill to assess.') if active_skills.empty?
  end
end
