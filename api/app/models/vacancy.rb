# frozen_string_literal: true

class Vacancy < ApplicationRecord
  include TenantScoped

  has_many :vacancy_skills, dependent: :destroy
  has_many :fit_gap_reports, dependent: :destroy
  has_many :vacancy_versions

  validates :role_title, presence: true

  accepts_nested_attributes_for :vacancy_skills,
                                 allow_destroy: true,
                                 reject_if: :all_blank

  after_save :create_vacancy_version

  private

  def create_vacancy_version
    VacancyVersion.create!(
      vacancy_id: id,
      role_title: role_title,
      culture_dimensions: culture_dimensions,
      competency_expectations: competency_expectations,
      public_requirement_text: public_requirement_text,
      skills_snapshot: vacancy_skills.reload.map do |skill|
        { skill_id: skill.skill_id, skill_label: skill.skill_label, expected_level: skill.expected_level }
      end
    )
  end
end
