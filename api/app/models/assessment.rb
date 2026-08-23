# frozen_string_literal: true

class Assessment < ApplicationRecord
  include TenantScoped
  # Index responses render latest_session, so Session writes must invalidate
  # this model's cache too (see the after_commit in Session).
  include CacheVersion

  has_many :assessment_skills, dependent: :destroy, inverse_of: :assessment
  has_many :sessions, dependent: :restrict_with_error

  # Eager-loads only the latest session per assessment (single LATERAL join)
  # instead of loading every session row. Aliased columns (ls_*) are read by
  # AssessmentSerializer to build the latest_session summary.
  #
  # Selects only the columns the serializer exposes — deliberately skips
  # system_prompt (large TEXT) since list responses never include it.
  scope :with_latest_session, -> {
    select(<<~SQL.squish)
      assessments.id, assessments.name, assessments.time_limit_min,
      assessments.language, assessments.created_by,
      assessments.created_at, assessments.updated_at,
      ls.id AS ls_id, ls.status AS ls_status, ls.end_reason AS ls_end_reason
    SQL
      .joins(<<~SQL.squish)
        LEFT JOIN LATERAL (
          SELECT s.id, s.status, s.end_reason
          FROM sessions s
          WHERE s.assessment_id = assessments.id
          ORDER BY s.created_at DESC
          LIMIT 1
        ) ls ON TRUE
      SQL
  }

  SUPPORTED_LANGUAGES = { 'en' => 'English', 'id' => 'Bahasa Indonesia' }.freeze

  validates :name, presence: true
  validates :time_limit_min, presence: true,
                              inclusion: { in: [10, 30, 45, 60, 90] }
  validates :language, inclusion: { in: SUPPORTED_LANGUAGES.keys }, allow_nil: true

  accepts_nested_attributes_for :assessment_skills,
                                 allow_destroy: true,
                                 reject_if: :all_blank
end
