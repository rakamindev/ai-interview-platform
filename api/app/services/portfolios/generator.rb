module Portfolios
  class Generator
    GENERATION_LOCK_TIMEOUT = 10 * 60
    SAFE_ERROR_MESSAGE = "Portfolio generation is temporarily unavailable. Please try again."

    def initialize(session:, gemini_client: nil)
      @session = session
      @gemini_client = gemini_client || Gemini::HttpClient.new(
        model: ENV.fetch("GEMINI_PRO_MODEL", "gemini-3.1-pro-preview"),
        timeout: 180
      )
    end

    def call
      portfolio = find_or_create_portfolio
      generation_token = claim_portfolio(portfolio)
      return portfolio if generation_token.nil?

      response = @gemini_client.generate_content(build_prompt, temperature: 0.2)
      normalized_skills = ResultNormalizer.new(
        assessment_skills: @session.assessment.assessment_skills.order(:display_order),
        response:
      ).call

      return portfolio unless persist_skills!(portfolio, normalized_skills, generation_token)

      complete_portfolio!(portfolio, generation_token)

      Rails.logger.info("[N10] Portfolio generated for session #{@session.id}")
      portfolio.reload
    rescue StandardError => e
      fail_portfolio!(portfolio, generation_token, e) if portfolio
      Rails.logger.error("[N10] Portfolio generation failed for session #{@session.id}: #{e.class}")
      raise
    end

    private

    def find_or_create_portfolio
      @session.with_lock do
        @session.portfolio || @session.create_portfolio!(
          candidate_id: @session.candidate_id,
          generation_status: "pending"
        )
      end
    rescue ActiveRecord::RecordNotUnique
      @session.reload.portfolio
    end

    def claim_portfolio(portfolio)
      token = nil

      portfolio.with_lock do
        if portfolio.complete?
          next
        end

        if portfolio.generating? && portfolio.generation_started_at &&
           portfolio.generation_started_at > Time.current - GENERATION_LOCK_TIMEOUT
          next
        end

        token = SecureRandom.hex(24)
        portfolio.update!(
          generation_status: "generating",
          generation_error: nil,
          generation_started_at: Time.current,
          generation_token: token
        )
      end

      token
    end

    def persist_skills!(portfolio, normalized_skills, generation_token)
      persisted = false

      portfolio.with_lock do
        next unless portfolio.generation_token == generation_token && portfolio.generating?

        portfolio.portfolio_skills.destroy_all
        normalized_skills.each do |skill_attributes|
          portfolio.portfolio_skills.create!(skill_attributes)
        end
        persisted = true
      end

      persisted
    end

    def complete_portfolio!(portfolio, generation_token)
      portfolio.with_lock do
        return unless portfolio.generation_token == generation_token

        portfolio.update!(
          generation_status: "complete",
          generated_at: Time.current,
          generation_error: nil,
          generation_started_at: nil,
          generation_token: nil
        )
      end
    end

    def fail_portfolio!(portfolio, generation_token, _error)
      portfolio.with_lock do
        next unless portfolio.generation_token == generation_token

        portfolio.update(
          generation_status: "failed",
          generation_error: SAFE_ERROR_MESSAGE,
          generation_started_at: nil,
          generation_token: nil
        )
      end
    rescue StandardError
      nil
    end

    def build_prompt
      assessment = @session.assessment
      configured_skills = assessment.assessment_skills.order(:display_order)
      coverage_maps = @session.coverage_maps.order(:id)
      turns = @session.transcript_turns.ordered

      skills_text = configured_skills.map { |skill| skill_definition_block(skill) }.join("\n\n")
      coverage_json = {
        skills: coverage_maps.reject(&:is_discovered).map { |map| coverage_json(map) },
        discovered: coverage_maps.select(&:is_discovered).map { |map| coverage_json(map) }
      }.to_json
      transcript_text = turns.map { |turn| "[#{turn.speaker.upcase}]: #{turn.text.to_s.slice(0, 4000)}" }.join("\n").slice(0, 120_000)

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
      lines << "SKILL: #{skill.skill_label} (#{skill.skill_id || "custom"})"
      lines << "SCOPE: #{skill.scope_include.to_s.slice(0, 2000)}" if skill.scope_include.present?
      lines << ""
      lines << "L1 — #{skill.l1_anchor.to_s.slice(0, 1200)}"
      lines << "L2 — #{skill.l2_anchor.to_s.slice(0, 1200)}"
      lines << "L3 — #{skill.l3_anchor.to_s.slice(0, 1200)}"
      lines << "L4 — #{skill.l4_anchor.to_s.slice(0, 1200)}"
      lines << "L5 — #{skill.l5_anchor.to_s.slice(0, 1200)}"
      lines.join("\n")
    end

    def coverage_json(map)
      {
        id: map.skill_id || map.skill_label.downcase.gsub(/\s+/, "-"),
        label: map.skill_label,
        state: map.state,
        probe_count: map.probe_count,
        is_discovered: map.is_discovered
      }
    end
  end
end
