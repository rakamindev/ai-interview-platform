# frozen_string_literal: true

module Portfolios
  # N10: Generates a structured skill portfolio from the full transcript
  # and final coverage map using Gemini Pro.
  # Runs post-session as a background job.
  class Generator
    def initialize(session:, gemini_client: nil)
      @session = session
      @gemini_client = gemini_client || Gemini::HttpClient.new(
        model:   ENV.fetch('GEMINI_PRO_MODEL', 'gemini-3.8-flash'),
        # gemini-2.0-pro-001 (the prior default) was retired by Google and
        # returns 404. gemini-3.8-flash is a reasoning ("thinking") model —
        # measured against this exact prompt shape with real transcript data,
        # a single call took over 180s and completed within 300s. 240s below
        # leaves headroom under Sidekiq's 300s job timeout (config/sidekiq.yml).
        timeout: 240
      )
    end

    # Returns the Portfolio record with skills populated.
    def call
      portfolio = @session.portfolio || @session.create_portfolio!(
        candidate_id:      @session.candidate_id,
        generation_status: 'pending'
      )

      portfolio.update!(generation_status: 'generating')

      prompt   = build_prompt
      response = @gemini_client.generate_content(prompt, temperature: 0.2)

      save_skills(portfolio, response)
      portfolio.update!(generation_status: 'complete', generated_at: Time.current)

      Rails.logger.info("[N10] Portfolio generated for session #{@session.id}")
      portfolio
    rescue => e
      portfolio&.update!(generation_status: 'failed', generation_error: e.message)
      Rails.logger.error("[N10] Portfolio generation failed for session #{@session.id}: #{e.class} #{e.message}")
      raise
    end

    private

    def build_prompt
      assessment       = @session.assessment
      configured_skills = assessment.assessment_skills.order(:display_order)
      coverage_maps     = @session.coverage_maps.order(:id)
      turns             = @session.transcript_turns.ordered

      skills_text = configured_skills.map { |s| skill_definition_block(s) }.join("\n\n")

      coverage_json = {
        skills:     coverage_maps.reject(&:is_discovered).map { |m| coverage_json(m) },
        discovered: coverage_maps.select(&:is_discovered).map { |m| coverage_json(m) }
      }.to_json

      transcript_text = turns.map { |t| "[#{t.speaker.upcase}]: #{t.text}" }.join("\n")

      <<~PROMPT
        You are evaluating a completed skills assessment interview to produce a structured skill portfolio.

        ROLE BEING ASSESSED: #{assessment.name}

        SKILL DEFINITIONS AND BEHAVIORAL ANCHORS:
        #{skills_text}

        UNIVERSAL L1-L5 ANCHORS (use for discovered skills):
        L1 — Executes with explicit guidance and close review. Understands conceptually but cannot apply independently.
        L2 — Executes independently on routine scope. Uses known patterns. Handles common cases but not edge cases.
        L3 — Executes complex, ambiguous scope. Makes tradeoffs. Handles edge cases. Can teach L1-L2.
        L4 — Defines standards and creates reusable systems. Resolves systemic problems. Cross-team impact.
        L5 — Org-level authority. Shapes how the skill is practiced. Rare.

        FINAL COVERAGE MAP:
        #{coverage_json}

        FULL INTERVIEW TRANSCRIPT:
        #{transcript_text}

        ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        TASK
        ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

        For EACH skill in the coverage map (both configured and discovered):

        1. FIND THE EVIDENCE
           Read all transcript turns where this skill was discussed.
           Identify the 2-3 most revealing quotes from the CANDIDATE (not the AI).
           A quote is revealing if it shows HOW they think, not just WHAT they know.

        2. ASSIGN A LEVEL
           Compare the candidate's actual behavior to the L1-L5 anchors.
           Assign the highest level where you see CONSISTENT evidence, not just one strong moment.
           If evidence is mixed (mostly L2 with one L3 moment), assign L2.

        3. WRITE THE COMPETENCY SUMMARY
           2-3 sentences. Focus on patterns, not individual answers.
           What does this person reliably do at this skill? What's the ceiling? What's missing?

        4. ASSIGN CONFIDENCE
           high — probe_count >= 3 AND state = covered
           medium — probe_count = 2 OR state = partial
           low — probe_count <= 1 OR state = initiated

        OUTPUT (JSON only, no prose):
        {
          "configured_skills": [
            {
              "skill_id": "sk-eng-001",
              "skill_label": "React / Frontend Development",
              "level": 3,
              "confidence": "high",
              "evidence": ["quote 1", "quote 2", "quote 3"],
              "competency_summary": "2-3 sentence summary"
            }
          ],
          "discovered_skills": [
            {
              "skill_label": "Micro-frontend Architecture",
              "level": 2,
              "confidence": "low",
              "evidence": ["quote 1"],
              "competency_summary": "2-3 sentence summary"
            }
          ]
        }
      PROMPT
    end

    def skill_definition_block(skill)
      lines = ["━━━━━━━━━━━━━━━"]
      lines << "SKILL: #{skill.skill_label} (#{skill.skill_id || 'custom'})"
      lines << "SCOPE: #{skill.scope_include}" if skill.scope_include.present?
      lines << ""
      lines << "L1 — #{skill.l1_anchor}"
      lines << "L2 — #{skill.l2_anchor}"
      lines << "L3 — #{skill.l3_anchor}"
      lines << "L4 — #{skill.l4_anchor}"
      lines << "L5 — #{skill.l5_anchor}"
      lines.join("\n")
    end

    def coverage_json(map)
      {
        id:          map.skill_id || map.skill_label.downcase.gsub(/\s+/, '-'),
        label:       map.skill_label,
        state:       map.state,
        probe_count: map.probe_count,
        is_discovered: map.is_discovered
      }
    end

    def save_skills(portfolio, response)
      data = response.is_a?(Hash) ? response : JSON.parse(response)
      configured_response = Array(data['configured_skills'])
      discovered_response = Array(data['discovered_skills'])
      coverage_maps        = @session.coverage_maps.to_a

      # Atomic: a validation failure partway through (e.g. a malformed
      # confidence value from the LLM) must not leave a partial skill set
      # under a portfolio whose generation_status says "failed" — the caller
      # (#call) sets that status outside this transaction, after it's clear
      # whether the whole set actually saved.
      # requires_new: true forces a real savepoint even when this runs
      # inside an already-open transaction (e.g. a future caller wrapping
      # Generator in its own transaction, or — exactly this case — under a
      # test suite's per-example transaction) — without it, Rails treats a
      # "nested" transaction as joining the parent one, and a raise here
      # would not actually undo these writes until whatever opened the
      # outer transaction finishes.
      portfolio.transaction(requires_new: true) do
        portfolio.portfolio_skills.destroy_all

        # Iterate the assessment's configured skills, not the AI response's
        # keys — a skill the AI's response omits entirely still gets a row
        # (not_assessed), rather than silently disappearing from the report.
        @session.assessment.assessment_skills.order(:display_order).each do |skill|
          skill_data = find_skill_data(configured_response, skill_id: skill.skill_id, skill_label: skill.skill_label)
          coverage   = find_coverage(coverage_maps, is_discovered: false, skill_id: skill.skill_id, skill_label: skill.skill_label)

          create_portfolio_skill(
            portfolio,
            skill_id: skill.skill_id, skill_label: skill.skill_label, is_discovered: false,
            skill_data: skill_data, coverage: coverage
          )
        end

        discovered_response.each do |skill_data|
          label    = skill_data['skill_label']
          coverage = find_coverage(coverage_maps, is_discovered: true, skill_id: nil, skill_label: label)

          create_portfolio_skill(
            portfolio,
            skill_id: nil, skill_label: label, is_discovered: true,
            skill_data: skill_data, coverage: coverage
          )
        end
      end
    rescue
      # When the transaction above rolls back to its savepoint, ActiveRecord
      # correctly resets each rolled-back record's own new_record?/id state
      # — but `portfolio`'s in-memory `portfolio_skills` association target
      # still holds references to those now-unsaved objects. Left alone, the
      # NEXT `portfolio.update!` (the caller's rescue, marking generation
      # 'failed') would silently re-INSERT them as a side effect of Rails
      # autosaving new records sitting in a loaded has_many target —
      # resurrecting exactly the partial data this transaction exists to
      # prevent. Proven by reproducing it with a plain `rails runner` script
      # (no test-framework transaction involved) before writing this fix.
      portfolio.portfolio_skills.reset
      raise
    end

    def create_portfolio_skill(portfolio, skill_id:, skill_label:, is_discovered:, skill_data:, coverage:)
      evidence = Array(skill_data && skill_data['evidence']).first(3)
      status = Portfolios::SkillStatus.derive(
        coverage:       coverage,
        raw_level:      skill_data && skill_data['level'],
        evidence_count: evidence.size
      )

      # A discovered skill exists in the response only because the AI
      # surfaced some signal for it — "not_assessed" (no evidence at all)
      # isn't a meaningful state for something that was, by construction,
      # at least weakly observed. Mirrors the backfill in the migration.
      if is_discovered && status.status == Portfolios::SkillStatus::NOT_ASSESSED
        status = Portfolios::SkillStatus::Result.new(status: "insufficient_evidence", level: nil, confidence: "low")
      end

      summary = (skill_data && skill_data['competency_summary']).presence || default_summary(status.status)

      portfolio.portfolio_skills.create!(
        skill_id:            skill_id,
        skill_label:         skill_label,
        is_discovered:       is_discovered,
        assessment_status:   status.status,
        ai_level:            status.level,
        ai_confidence:       status.confidence,
        evidence:            evidence,
        competency_summary:  summary
      )
    end

    def find_skill_data(response_skills, skill_id:, skill_label:)
      return nil if response_skills.blank?

      if skill_id.present?
        match = response_skills.find { |s| s['skill_id'] == skill_id }
        return match if match
      end
      response_skills.find { |s| normalize_label(s['skill_label']) == normalize_label(skill_label) }
    end

    def find_coverage(coverage_maps, is_discovered:, skill_id:, skill_label:)
      scoped = coverage_maps.select { |m| m.is_discovered == is_discovered }

      if skill_id.present?
        match = scoped.find { |m| m.skill_id == skill_id }
        return match if match
      end
      scoped.find { |m| normalize_label(m.skill_label) == normalize_label(skill_label) }
    end

    def normalize_label(label)
      label.to_s.strip.downcase.gsub(/\s+/, " ")
    end

    def default_summary(status)
      case status
      when Portfolios::SkillStatus::NOT_ASSESSED
        "This skill was not covered during the interview."
      when Portfolios::SkillStatus::INSUFFICIENT_EVIDENCE
        "Limited evidence was gathered for this skill during the interview."
      else
        "No summary was provided."
      end
    end
  end
end
