# frozen_string_literal: true

module Portfolios
  # N10: Generates a structured skill portfolio from the full transcript
  # and final coverage map using Gemini Pro.
  # Runs post-session as a background job.
  class Generator
    class InvalidRecommendation < StandardError; end
    class FinalizedPortfolio < StandardError; end

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

      raise FinalizedPortfolio, 'Cannot regenerate a portfolio after its decision is finalized' if portfolio.portfolio_decision&.finalized?

      portfolio.update!(generation_status: 'generating')

      prompt   = build_prompt
      response = @gemini_client.generate_content(prompt, temperature: 0.2)
      data = response.is_a?(Hash) ? response : JSON.parse(response)
      validate_recommendation!(data)

      Portfolio.transaction do
        portfolio.with_lock do
          raise FinalizedPortfolio, 'Cannot replace evidence after decision finalization' if portfolio.portfolio_decision&.finalized?

          save_skills(portfolio, data)
          save_ai_recommendation(portfolio, data.fetch('overall_recommendation'))
          portfolio.update!(generation_status: 'complete', generated_at: Time.current)
        end
      end

      Rails.logger.info("[N10] Portfolio generated for session #{@session.id}")
      portfolio
    rescue FinalizedPortfolio => e
      Rails.logger.warn("[N10] #{e.message} (session=#{@session.id})")
      raise
    rescue => e
      portfolio&.update!(generation_status: 'failed', generation_error: e.message)
      Rails.logger.error("[N10] Portfolio generation failed for session #{@session.id}: #{e.class} #{e.message}")
      raise
    end

    private

    def build_prompt
      rubric           = @session.rubric
      configured_skills = rubric.rubric_skills.order(:display_order)
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

        ROLE BEING ASSESSED: #{rubric.name}

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

        5. RECOMMEND AN OVERALL OUTCOME
           Compare the evidence and assigned levels for configured skills against their EXPECTED LEVELS.
           Make a holistic recommendation, not a mechanical all-skills gate. Discovered skills may add context but cannot replace a
           configured requirement. Recommend "pass" when the candidate broadly demonstrates the role requirements; otherwise
           recommend "fail". This is an advisory assessment recommendation, not a final hiring decision.

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
          ],
          "overall_recommendation": {
            "outcome": "pass",
            "rationale": "2-4 concise sentences grounded in configured-skill evidence and expected levels"
          }
        }
      PROMPT
    end

    def skill_definition_block(skill)
      lines = ["━━━━━━━━━━━━━━━"]
      lines << "SKILL: #{skill.skill_label} (#{skill.skill_id || 'custom'})"
      lines << "EXPECTED LEVEL: L#{skill.expected_level}"
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

    def save_skills(portfolio, data)
      # Destroy existing skills (idempotent regeneration)
      portfolio.portfolio_skills.destroy_all

      (data['configured_skills'] || []).each do |skill_data|
        portfolio.portfolio_skills.create!(
          skill_id:           skill_data['skill_id'],
          skill_label:        skill_data['skill_label'],
          is_discovered:      false,
          ai_level:           skill_data['level'].to_i.clamp(1, 5),
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
          ai_level:           skill_data['level'].to_i.clamp(1, 5),
          ai_confidence:      skill_data['confidence'],
          evidence:           Array(skill_data['evidence']).first(3),
          competency_summary: skill_data['competency_summary']
        )
      end
    end

    def validate_recommendation!(data)
      recommendation = data['overall_recommendation']
      raise InvalidRecommendation, 'Portfolio response is missing overall_recommendation' unless recommendation.is_a?(Hash)

      outcome = recommendation['outcome'].to_s.downcase
      rationale = recommendation['rationale'].to_s.strip
      return if PortfolioDecision::OUTCOMES.include?(outcome) && rationale.present?

      raise InvalidRecommendation, 'Portfolio recommendation must include pass/fail outcome and rationale'
    end

    def save_ai_recommendation(portfolio, recommendation)
      decision = portfolio.portfolio_decision || portfolio.build_portfolio_decision
      return decision if decision.persisted? && decision.ai_recommendation_available?

      decision.assign_attributes(
        ai_outcome:        recommendation.fetch('outcome').to_s.downcase,
        ai_rationale:      recommendation.fetch('rationale').to_s.strip,
        ai_recommended_at: Time.current
      )
      decision.save!
      decision.portfolio_decision_events.create!(
        event_type: 'ai_recommended',
        outcome:    decision.ai_outcome,
        note:       decision.ai_rationale
      )
      decision
    end
  end
end
