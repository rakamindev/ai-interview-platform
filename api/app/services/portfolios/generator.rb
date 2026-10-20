# frozen_string_literal: true

module Portfolios
  # N10: Generates a structured skill portfolio from the full transcript
  # and final coverage map using Gemini Pro.
  # Runs post-session as a background job.
  class Generator
    def initialize(session:, gemini_client: nil)
      @session = session
      @gemini_client = gemini_client || Gemini::HttpClient.new(
        model:   ENV.fetch('GEMINI_PRO_MODEL', 'gemini-2.0-pro-001'),
        timeout: 180  # up to 3 minutes for large transcripts
      )
    end

    # Returns the Portfolio record with skills populated.
    def call
      portfolio = @session.portfolio || @session.create_portfolio!(
        candidate_id:      @session.candidate_id,
        generation_status: 'pending'
      )

      portfolio.update!(generation_status: 'generating', generation_error: nil)

      # No candidate speech means no evidence: record every skill as not assessed without a model call.
      response = candidate_spoke? ? @gemini_client.generate_content(build_prompt, temperature: 0.2) : {}
      rows = SkillReconciler.new(assessment_skills: configured_skills, response: response).call

      # Replace skills atomically: a failure leaves the previous skills (and their overrides) untouched.
      Portfolio.transaction do
        portfolio.portfolio_skills.destroy_all
        rows.each { |attrs| portfolio.portfolio_skills.create!(attrs) }
        portfolio.update!(generation_status: 'complete', generated_at: Time.current)
      end

      Rails.logger.info("[N10] Portfolio generated for session #{@session.id}: " \
                        "#{rows.count { |r| r[:ai_level] }} of #{rows.size} skills assessed")
      portfolio
    rescue => e
      # Status stays 'generating' while Sidekiq retries; PortfolioGeneratorWorker marks it 'failed'
      # only once retries are exhausted, so the UI never offers Retry while a retry is queued.
      portfolio&.update_columns(generation_error: e.message.truncate(500))
      Rails.logger.error("[N10] Portfolio generation failed for session #{@session.id}: #{e.class} #{e.message}")
      raise
    end

    private

    def build_prompt
      assessment    = @session.assessment
      coverage_maps = @session.coverage_maps.order(:id)
      turns         = @session.transcript_turns.ordered

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

        For EACH configured skill, and for any additional skill the candidate clearly demonstrated:

        1. FIND THE EVIDENCE
           Read all transcript turns where this skill was discussed.
           Identify the 2-3 most revealing quotes from the CANDIDATE (not the AI), copied from the transcript.
           A quote is revealing if it shows HOW they think, not just WHAT they know.
           The coverage map is a hint about what was discussed; it may be incomplete. The transcript is the source of truth.

        2. ASSIGN A LEVEL, OR MARK IT NOT ASSESSED
           Compare the candidate's actual behavior to the L1-L5 anchors.
           Assign the highest level where you see CONSISTENT evidence, not just one strong moment.
           If evidence is mixed (mostly L2 with one L3 moment), assign L2.
           The level must be a plain integer 1-5.
           If the candidate gave NO evidence for a skill (never discussed, deflected, or only the AI talked about it),
           set "level": null, "confidence": null, "evidence": [] and say in the summary what was not covered.
           Never use L1 as a placeholder for missing evidence: L1 means evidence of foundational ability.

        3. WRITE THE COMPETENCY SUMMARY
           2-3 sentences. Focus on patterns, not individual answers.
           What does this person reliably do at this skill? What's the ceiling? What's missing?

        4. ASSIGN CONFIDENCE (only when a level is assigned)
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
            },
            {
              "skill_id": "sk-eng-004",
              "skill_label": "Database Design & SQL",
              "level": null,
              "confidence": null,
              "evidence": [],
              "competency_summary": "Not covered: the candidate did not discuss database work."
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

    def configured_skills
      @configured_skills ||= @session.assessment.assessment_skills.order(:display_order)
    end

    def candidate_spoke?
      @session.transcript_turns.where(speaker: 'candidate').exists?
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
  end
end
