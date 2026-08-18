# frozen_string_literal: true

class Assessment < ApplicationRecord
  include TenantScoped

  has_many :assessment_skills, dependent: :destroy, inverse_of: :assessment
  has_many :sessions, dependent: :restrict_with_error
  has_many :assessment_versions

  SUPPORTED_LANGUAGES = { 'en' => 'English', 'id' => 'Bahasa Indonesia' }.freeze

  validates :name, presence: true
  validates :time_limit_min, presence: true,
                              inclusion: { in: [10, 30, 45, 60, 90] }
  validates :language, inclusion: { in: SUPPORTED_LANGUAGES.keys }, allow_nil: true

  accepts_nested_attributes_for :assessment_skills,
                                 allow_destroy: true,
                                 reject_if: :all_blank

  after_save :create_assessment_version

  private

  def create_assessment_version
    AssessmentVersion.create!(
      assessment_id: id,
      name: name,
      time_limit_min: time_limit_min,
      language: language,
      skills_snapshot: assessment_skills.reload.sort_by(&:display_order).map do |skill|
        {
          skill_id: skill.skill_id,
          skill_label: skill.skill_label,
          is_custom: skill.is_custom,
          scope_include: skill.scope_include,
          scope_exclude: skill.scope_exclude,
          l1_anchor: skill.l1_anchor,
          l2_anchor: skill.l2_anchor,
          l3_anchor: skill.l3_anchor,
          l4_anchor: skill.l4_anchor,
          l5_anchor: skill.l5_anchor,
          expected_level: skill.expected_level,
          display_order: skill.display_order
        }
      end
    )
  end
end
