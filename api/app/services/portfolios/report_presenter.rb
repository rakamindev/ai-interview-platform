# frozen_string_literal: true

module Portfolios
  # What the API says about a report: its state, why it failed, what it rests
  # on, and each skill as the product may show it. The web only turns these
  # into words and colours. It never works them out itself.
  #
  # state: pending · generating · stalled · complete · partial · empty · failed
  class ReportPresenter
    READY_STATES = %w[complete partial empty].freeze

    def initialize(portfolio, now: Time.current)
      @portfolio = portfolio
      @session = portfolio.session
      @now = now
    end

    def as_json(*)
      {
        id:                @portfolio.id,
        session_id:        @portfolio.session_id,
        candidate_id:      @portfolio.candidate_id,
        generation_status: @portfolio.generation_status,
        state:             state,
        can_retry:         can_retry?,
        generated_at:      @portfolio.generated_at,
        status_changed_at: @portfolio.status_changed_at,
        failure:           failure,
        summary:           summary,
        skills:            ready? ? skills.map { |skill| skill_json(skill) } : [],
        overrides:         ready? ? @portfolio.assessor_overrides.map { |o| override_json(o) } : []
      }
    end

    def state
      @state ||= case @portfolio.generation_status
                 when 'pending', 'generating' then state_while_running
                 when 'complete' then state_when_done
                 else 'failed'
                 end
    end

    def ready?
      READY_STATES.include?(state)
    end

    # Exports only show a finished report with every skill accounted for.
    def exportable?
      state == 'complete'
    end

    # Try again is offered only when it can help, and never wipes a review.
    def can_retry?
      case state
      when 'failed', 'stalled' then failure[:retryable]
      when 'partial' then @portfolio.assessor_overrides.none?
      else false
      end
    end

    private

    def state_while_running
      return 'stalled' if @portfolio.status_changed_at <= @now - Portfolio::STALL_AFTER
      # A pending report that already failed once is waiting for the job queue's next try.
      return 'generating' if @portfolio.generating? || @portfolio.failure_kind.present?

      'pending'
    end

    def state_when_done
      configured = skills.reject(&:is_discovered)
      return 'empty' if configured.empty?
      return 'partial' if configured.any? { |skill| skill.status == 'unavailable' }

      'complete'
    end

    def failure
      return unless %w[failed stalled].include?(state)

      # A stopped job, or an error on our side, has no stored kind.
      kind = state == 'failed' ? (@portfolio.failure_kind || 'worker_lost') : 'worker_lost'
      { kind: kind, occurred_at: @portfolio.status_changed_at, retryable: kind != 'no_interview_data' }
    end

    # What the report rests on. Status counts cover configured skills only,
    # and are null until a report exists.
    def summary
      configured = skills.reject(&:is_discovered)
      counts = PortfolioSkill::STATUSES.to_h do |status|
        [status.to_sym, (configured.count { |skill| skill.status == status } if ready?)]
      end

      {
        total_skills:     total_skills,
        **counts,
        discovered:       (skills.count(&:is_discovered) if ready?),
        turns:            @session.transcript_turns.size,
        duration_seconds: @session.duration_seconds,
        end_reason:       @session.end_reason
      }
    end

    # The skills this interview set out to cover: the report's own list once it
    # exists (so the counts always add up), before that the interview's coverage.
    def total_skills
      return skills.count { |skill| !skill.is_discovered } if ready?

      configured_maps = @session.coverage_maps.count { |map| !map.is_discovered }
      configured_maps.positive? ? configured_maps : @session.assessment.assessment_skills.size
    end

    # Absent skills carry no level, confidence, quotes or summary, even when an
    # older row still holds them. raw_level stays in the database for operators.
    def skill_json(skill)
      rated = skill.rated?
      {
        id:                 skill.id,
        skill_id:           skill.skill_id,
        skill_label:        skill.skill_label,
        is_discovered:      skill.is_discovered,
        status:             skill.status,
        ai_level:           skill.rated_level,
        caveat:             (skill.caveat if rated),
        ai_confidence:      (skill.ai_confidence if rated),
        coverage_state:     skill.coverage_state,
        probe_count:        skill.probe_count,
        anchor:             (anchor_for(skill) if rated),
        evidence:           rated ? skill.evidence_quotes : [],
        competency_summary: (skill.competency_summary if rated)
      }
    end

    # The assessment's own description of the level given, so a reader can
    # check the rating against it. Discovered skills have no configured anchor.
    def anchor_for(skill)
      return if skill.is_discovered

      configured = assessment_skills.find { |a| same_text?(a.skill_id, skill.skill_id) } ||
                   assessment_skills.find { |a| same_text?(a.skill_label, skill.skill_label) }
      configured&.public_send("l#{skill.rated_level}_anchor")
    end

    def override_json(override)
      {
        id:                 override.id,
        portfolio_skill_id: override.portfolio_skill_id,
        ai_level:           override.ai_level,
        override_level:     override.override_level,
        assessor_notes:     override.assessor_notes,
        overridden_by:      override.overridden_by,
        overridden_at:      override.overridden_at
      }
    end

    def skills
      @skills ||= @portfolio.portfolio_skills.order(:id).to_a
    end

    def assessment_skills
      @assessment_skills ||= @session.assessment.assessment_skills.to_a
    end

    def same_text?(a, b)
      a.is_a?(String) && b.is_a?(String) && a.strip.casecmp?(b.strip)
    end
  end
end
