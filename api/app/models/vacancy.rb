# frozen_string_literal: true

class Vacancy < ApplicationRecord
  include TenantScoped

  has_many :vacancy_skills, dependent: :destroy
  has_many :fit_gap_reports, dependent: :destroy

  validates :role_title, presence: true
  validate :required_skills_are_present_and_unique

  accepts_nested_attributes_for :vacancy_skills,
                                 allow_destroy: true,
                                 reject_if: :all_blank

  private

  def required_skills_are_present_and_unique
    skills = vacancy_skills.reject(&:marked_for_destruction?)

    if skills.empty?
      errors.add(:vacancy_skills, "must include at least one required skill")
      return
    end

    identities = skills.map do |skill|
      if skill.skill_id.present?
        "id:#{skill.skill_id}"
      else
        "label:#{normalize_skill_label(skill.skill_label)}"
      end
    end

    errors.add(:vacancy_skills, "must contain unique skills") if identities.uniq.length != identities.length
  end

  def normalize_skill_label(label)
    label.to_s.strip.downcase.gsub(/\s+/, " ")
  end
end
