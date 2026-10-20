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
  validate :skill_labels_unique

  accepts_nested_attributes_for :assessment_skills,
                                 allow_destroy: true,
                                 reject_if: :all_blank

  private

  # coverage_maps has a unique index on (session_id, skill_label); a duplicate label
  # makes every session of this assessment fail to start.
  def skill_labels_unique
    labels = assessment_skills.reject(&:marked_for_destruction?).map { |s| s.skill_label.to_s.strip.downcase }
    duplicates = labels.select { |l| labels.count(l) > 1 }.uniq
    return if duplicates.empty?

    errors.add(:base, "Each skill can only be added once (duplicate: #{duplicates.join(', ')})")
  end
end
