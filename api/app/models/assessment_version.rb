# frozen_string_literal: true

class AssessmentVersion < ApplicationRecord
  belongs_to :assessment
  has_many :assessment_version_skills, dependent: :restrict_with_error
  has_many :sessions, dependent: :restrict_with_error

  attr_readonly :assessment_id, :rubric_version, :name, :time_limit_min, :language, :system_prompt

  before_update :prevent_mutation
  before_destroy :prevent_destruction

  validates :rubric_version, numericality: { only_integer: true, greater_than: 0 },
                            uniqueness: { scope: :assessment_id }
  validates :name, :system_prompt, presence: true
  validates :time_limit_min, inclusion: { in: [10, 30, 45, 60, 90] }
  validates :language, inclusion: { in: Assessment::SUPPORTED_LANGUAGES.keys }

  def rubric_skills
    assessment_version_skills
  end

  def allow_skill_copies
    @allow_skill_copies = true
    yield
  ensure
    @allow_skill_copies = false
  end

  def allowing_skill_copies?
    @allow_skill_copies == true
  end

  private

  def prevent_mutation
    errors.add(:base, 'Published assessment versions are immutable')
    throw(:abort)
  end

  def prevent_destruction
    errors.add(:base, 'Published assessment versions cannot be deleted')
    throw(:abort)
  end
end
