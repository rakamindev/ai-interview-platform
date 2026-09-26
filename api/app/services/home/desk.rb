# frozen_string_literal: true

module Home
  # The review desk: what needs a person now.
  # Every section is built on its own, so one failing section never blanks
  # the page. No levels, confidence, quotes or summaries leave this class:
  # names and references are enough to act.
  class Desk
    FAILED_WINDOW  = 14.days
    RESULTS_WINDOW = 7.days
    LIST_CAP       = 50
    STALE_LIVE_AFTER = 15.minutes # past the time limit

    def initialize(since: nil, now: Time.current)
      @since = since
      @now = now
    end

    def as_json(*)
      sections = {
        needs_you: section { needs_you },
        live:      section { live },
        results:   section { results }
      }
      { generated_at: @now, summary: section { summary }, **sections }
    end

    private

    def section
      { status: 'ok', data: yield }
    rescue StandardError => e
      Rails.logger.error("[Home::Desk] #{e.class}: #{e.message}")
      { status: 'error' }
    end

    def summary
      reports = recent_reports
      {
        failed_needing_reinvite: failed_interviews.size,
        stuck_reports:           stuck_reports.size,
        needs_look_7d:           reports.count { |r| needs_look?(r) },
        live:                    live_sessions.count { |s| !stale?(s) },
        stale_live:              live_sessions.count { |s| stale?(s) },
        last_result_at:          reports.map { |r| r[:portfolio].generated_at }.max,
        **new_counts(reports)
      }
    end

    # Harm first: failed interviews, then stuck reports, then one grouped row.
    # Oldest first within a type: the person who waited longest comes first.
    def needs_you
      look = recent_reports.select { |r| needs_look?(r) }
      items = failed_interviews.map { |s| failed_item(s) } +
              stuck_reports.map { |r| stuck_item(r) }
      items << { type: 'needs_look_group', count: look.size,
                 partial_count: look.count { |r| r[:state] == 'partial' } } if look.any?
      { total: items.size, items: items.first(LIST_CAP) }
    end

    def live
      live_sessions.map do |s|
        { session_id: s.id, candidate_name: s.candidate_name, assessment: assessment_json(s),
          started_at: s.started_at, time_limit_min: s.assessment.time_limit_min, stale: stale?(s) }
      end
    end

    def results
      items = recent_reports.map do |r|
        session = r[:portfolio].session
        { session_id: session.id, reference: session.reference, candidate_name: session.candidate_name,
          assessment: assessment_json(session), state: r[:state], generated_at: r[:portfolio].generated_at,
          duration_seconds: session.duration_seconds, skill_statuses: r[:statuses],
          new: @since.present? && r[:portfolio].generated_at > @since }
      end
      { total: items.size, items: items.first(LIST_CAP) }
    end

    # --- facts ---------------------------------------------------------------

    # Failed on our side in the last 14 days, and not re-invited yet. Until an
    # exact re-invite link exists, a newer invite for the same name in the same
    # assessment counts as a re-invite.
    def failed_interviews
      @failed_interviews ||= Session.includes(:assessment)
                                    .where("status = 'failed' OR end_reason = 'error'")
                                    .where('COALESCE(ended_at, created_at) >= ?', @now - FAILED_WINDOW)
                                    .order(Arel.sql('COALESCE(ended_at, created_at)'))
                                    .reject { |s| reinvited?(s) }
    end

    def reinvited?(session)
      return false if session.candidate_name.blank?

      Session.where(assessment_id: session.assessment_id).where.not(id: session.id)
             .where('LOWER(candidate_name) = ?', session.candidate_name.downcase)
             .where('created_at > ?', session.ended_at || session.created_at)
             .exists?
    end

    # Stalled, or failed in a way trying again can fix, in the last 14 days.
    def stuck_reports
      @stuck_reports ||= tenant_portfolios
                         .where(generation_status: %w[pending generating failed])
                         .where('portfolios.status_changed_at >= ?', @now - FAILED_WINDOW)
                         .order(:status_changed_at)
                         .map { |p| report_facts(p) }
                         .select { |r| r[:state] == 'stalled' || (r[:state] == 'failed' && r[:json][:failure][:retryable]) }
    end

    # Finished reports from the last 7 days, newest first.
    def recent_reports
      @recent_reports ||= tenant_portfolios
                          .where(generation_status: 'complete')
                          .where('portfolios.generated_at >= ?', @now - RESULTS_WINDOW)
                          .order(generated_at: :desc)
                          .map { |p| report_facts(p) }
                          .select { |r| %w[complete partial].include?(r[:state]) }
    end

    def live_sessions
      @live_sessions ||= Session.includes(:assessment).where(status: 'active').order(:started_at).to_a
    end

    # --- helpers ---------------------------------------------------------------

    def tenant_portfolios
      Portfolio.includes(session: :assessment).where(session_id: Session.select(:id))
    end

    def report_facts(portfolio)
      json = Portfolios::ReportPresenter.new(portfolio, now: @now).as_json
      configured = json[:skills].reject { |s| s[:is_discovered] }
      { portfolio: portfolio, state: json[:state], json: json, statuses: configured.map { |s| s[:status] } }
    end

    def needs_look?(report)
      report[:state] == 'partial' || report[:statuses].include?('thin_evidence')
    end

    # "New" only exists when the client says when it last looked.
    def new_counts(reports)
      return {} unless @since

      fresh = reports.select { |r| r[:portfolio].generated_at > @since }
      { new_results: fresh.size, new_needs_look: fresh.count { |r| needs_look?(r) } }
    end

    def stale?(session)
      return false unless session.started_at

      @now - session.started_at > session.assessment.time_limit_min.minutes + STALE_LIVE_AFTER
    end

    def failed_item(session)
      { type: 'failed_interview', session_id: session.id, reference: session.reference,
        candidate_name: session.candidate_name, assessment: assessment_json(session),
        ended_at: session.ended_at, duration_seconds: session.duration_seconds,
        turns: session.transcript_turns.count }
    end

    def stuck_item(report)
      session = report[:portfolio].session
      { type: 'stuck_report', session_id: session.id, reference: session.reference,
        candidate_name: session.candidate_name, assessment: assessment_json(session),
        state: report[:state], since: report[:portfolio].status_changed_at,
        failure_kind: report[:json].dig(:failure, :kind), can_retry: report[:json][:can_retry] }
    end

    def assessment_json(session)
      { id: session.assessment_id, name: session.assessment.name }
    end
  end
end
