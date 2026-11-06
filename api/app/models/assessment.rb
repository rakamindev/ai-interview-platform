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

  # W27: a skill listed twice broke every interview for the assessment (the coverage map allows one
  # row per skill label). Reject it at save time, where the assessor can fix it. Labels are compared
  # trimmed, with inner spaces collapsed and case ignored ("React", " react ").
  # Only checked when the skill list changes, so an assessment saved before this rule can still have
  # unrelated fields edited, and can be fixed by removing the duplicate.
  validate :skill_labels_unique, if: :skill_list_changing?

  def self.normalize_skill_label(label)
    label.to_s.unicode_normalize(:nfkc).strip.squeeze(' ').downcase
  end

  private

  def skill_list_changing?
    assessment_skills.any? { |s| s.new_record? || s.marked_for_destruction? || s.will_save_change_to_skill_label? }
  end

  def skill_labels_unique
    kept = assessment_skills.reject(&:marked_for_destruction?)
    _, duplicates = kept.group_by { |s| self.class.normalize_skill_label(s.skill_label) }
                        .find { |key, group| key.present? && group.size > 1 }
    return unless duplicates

    errors.add(:base, "Skill \"#{duplicates.first.skill_label.to_s.strip}\" is listed more than once. " \
                      'Remove the duplicate before saving.')
  end
end
