# frozen_string_literal: true

module Sessions
  # Builds and saves a Session, stamping it with the assessment's current
  # AssessmentVersion at invite time — not at interview-start time. This is what
  # makes a candidate's interview immune to later edits of the assessment (see
  # Sessions::StartHandler and Assessments::SystemPromptCompiler, which read from
  # the stamped version instead of the live assessment).
  #
  # Shared by SessionsController#create and, later, CvScreening::Inviter — one
  # invite path instead of duplicating this logic.
  class Creator
    def initialize(assessment:, tenant_id:, candidate_id: nil, candidate_name: nil)
      @assessment = assessment
      @tenant_id = tenant_id
      @candidate_id = candidate_id
      @candidate_name = candidate_name
    end

    # Returns the Session — persisted on success, unpersisted with errors on failure.
    def call
      session = @assessment.sessions.new(
        candidate_id: @candidate_id,
        candidate_name: @candidate_name,
        tenant_id: @tenant_id,
        assessment_version_id: current_assessment_version&.id
      )

      session.save
      session
    end

    private

    def current_assessment_version
      @assessment.assessment_versions.order(created_at: :desc).first
    end
  end
end
