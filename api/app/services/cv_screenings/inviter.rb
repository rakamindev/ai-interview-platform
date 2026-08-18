# frozen_string_literal: true

module CvScreenings
  # Thin wrapper around Sessions::Creator (Phase 4) — one invite path, not
  # duplicated logic. Candidates are identified by detected email only (no
  # candidate account, no filename-derived name — see the plan doc's explicit
  # out-of-scope list), so the email doubles as the session's candidate_name.
  class Inviter
    def initialize(entry:)
      @entry = entry
    end

    def call
      batch = @entry.cv_screening_batch

      Sessions::Creator.new(
        assessment:     batch.assessment,
        tenant_id:      @entry.tenant_id,
        candidate_name: @entry.detected_email
      ).call
    end
  end
end
