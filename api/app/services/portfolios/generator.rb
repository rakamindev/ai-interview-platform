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

      # Claim the portfolio before doing any work, and refuse to start if
      # someone else already holds it.
      #
      # save_skills begins with portfolio_skills.destroy_all, and PortfolioSkill
      # has_one :assessor_override, dependent: :destroy — so a second run racing
      # the first does not merely waste a Gemini call, it can delete an
      # assessor's correction and their notes. That correction is the product's
      # human-in-the-loop mechanism, and under UU PDP Art. 10 it is what makes a
      # rating contestable rather than purely automated.
      #
      # Two concurrent runs were observed doing exactly this: portfolio_skill
      # ids 1-5 replaced by 6-10 while both calls reported success.
      claimed = Portfolio.where(id: portfolio.id)
                         .where.not(generation_status: 'generating')
                         .update_all(generation_status: 'generating')

      if claimed.zero?
        Rails.logger.info("[N10] Portfolio #{portfolio.id} is already being generated — skipping duplicate job")
        return portfolio.reload
      end

      portfolio.reload

      prompt = build_prompt

      # temperature 0, not 0.2. This call reads fixed evidence — a finished
      # transcript and a finished coverage map — and reports what is in it. It
      # is not a creative task, and sampling made it disagree with itself: two
      # consecutive runs over identical input returned Communication L3 and then
      # L2. One level is the entire distance between `Match` and `Gap -1` in
      # FitGap::Engine, so that variance decides hiring outcomes. Comparability
      # between candidates is the premise of the whole product.
      response = @gemini_client.generate_content(prompt, temperature: 0)

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

    # `nil.to_i` is 0 and `.clamp(1, 5)` lifts it to 1, so a skill the model did
    # not probe was stored as "L1, Foundational": a rating on a real person
    # invented by a type coercion, indistinguishable on screen from one the
    # interview actually earned. An absent level stays absent.
    def level_from(raw)
      return nil if raw.nil? || raw.to_s.strip.empty?

      Integer(raw).clamp(1, 5)
    rescue ArgumentError, TypeError
      nil
    end

    def save_skills(portfolio, response)
      data = response.is_a?(Hash) ? response : JSON.parse(response)

      # Destroy existing skills (idempotent regeneration)
      portfolio.portfolio_skills.destroy_all

      (data['configured_skills'] || []).each do |skill_data|
        portfolio.portfolio_skills.create!(
          skill_id:           skill_data['skill_id'],
          skill_label:        skill_data['skill_label'],
          is_discovered:      false,
          ai_level:           level_from(skill_data['level']),
          ai_confidence:      skill_data['confidence'],
          evidence:           Array(skill_data['evidence']).first(3),
          competency_summary: skill_data['competency_summary']
        )
      end

      (data['discovered_skills'] || []).each do |skill_data|
        portfolio.portfolio_skills.create!(
          skill_id:           nil,
          skill_label:        skill_data['skill_label'],
          is_discovered:      true,
          ai_level:           level_from(skill_data['level']),
          ai_confidence:      skill_data['confidence'],
          evidence:           Array(skill_data['evidence']).first(3),
          competency_summary: skill_data['competency_summary']
        )
      end
    end
  end
end
