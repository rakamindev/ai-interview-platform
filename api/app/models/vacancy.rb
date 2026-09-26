# frozen_string_literal: true

class Vacancy < ApplicationRecord
  include TenantScoped

  has_many :vacancy_skills, dependent: :destroy
  has_many :fit_gap_reports, dependent: :destroy

  validates :role_title, presence: true

  accepts_nested_attributes_for :vacancy_skills,
                                 allow_destroy: true,
                                 reject_if: :all_blank

  validate :unique_vacancy_skill_labels

  private

  def unique_vacancy_skill_labels
    active_skills = vacancy_skills.reject(&:marked_for_destruction?)
    labels = active_skills.map { |s| s.skill_label&.strip&.downcase }.compact.reject(&:blank?)
    duplicates = labels.select { |lbl| labels.count(lbl) > 1 }.uniq
    return if duplicates.empty?

    errors.add(:base, "Duplicate skill labels detected: #{duplicates.join(', ')}. Each skill in a vacancy must be unique.")
  end
end
