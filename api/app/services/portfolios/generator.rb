# frozen_string_literal: true

module Portfolios
  # N10: Generates a structured skill portfolio from the full transcript
  # and final coverage map using Gemini Pro.
  # Runs post-session as a background job.
  class Generator
    def initialize(session:, gemini_client: nil)
      @session = session
      @gemini_client = gemini_client || Gemini::HttpClient.new(
        model:   Gemini::Models.pro,
        timeout: 180  # up to 3 minutes for large transcripts
      )
    end

    # Returns the Portfolio record with skills populated.
    def call
      portfolio = @session.portfolio || @session.create_portfolio!(
        candidate_id:      @session.candidate_id,
        generation_status: 'pending'
      )

      # Another job has it, or it is already done.
      return portfolio unless portfolio.claim!

      # Nothing was said, so there is nothing to rate. Asking the AI anyway
      # would only invent a report, and trying again can't help.
      unless @session.transcript_turns.exists?
        portfolio.fail!('no_interview_data', 'The interview has no transcript turns')
        return portfolio
      end

      response = @gemini_client.generate_content(build_prompt, temperature: 0.2)
      save_skills(portfolio, response)

      Rails.logger.info("[N10] Portfolio generated for session #{@session.id}")
      portfolio
    rescue => e
      # The job queue retries, and marks the report failed after the last try.
      portfolio&.retry_later!(failure_kind_for(e), e.message)
      Rails.logger.error("[N10] Portfolio generation failed for session #{@session.id}: #{e.class} #{e.message}")
      raise
    end

    private

    # Anything else is an error on our side. It is retried too, but has no
    # kind, because it is neither the AI's fault nor missing data.
    def failure_kind_for(error)
      case error
      when Gemini::HttpClient::EmptyResponseError, JSON::ParserError, SkillResolver::InvalidAnswer
        'model_response_invalid'
      when Gemini::HttpClient::ApiError # includes timeouts and rate limits
        'model_unavailable'
      end
    end

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
      answer = response.is_a?(Hash) ? response : JSON.parse(response)
      rows   = SkillResolver.new(coverage_maps: @session.coverage_maps.order(:id).to_a, answer: answer).call

      # All or nothing: if anything fails half way, the previous skills stay.
      # The rows are written by portfolio_id, not through portfolio.portfolio_skills:
      # rows held in that list would be saved again by the next portfolio.update!
      # (Rails autosave), even after the transaction rolled back.
      Portfolio.transaction do
        PortfolioSkill.where(portfolio_id: portfolio.id).destroy_all
        rows.each { |attributes| PortfolioSkill.create!(attributes.merge(portfolio_id: portfolio.id)) }
        portfolio.update!(generation_status: 'complete', generated_at: Time.current,
                          failure_kind: nil, generation_error: nil)
      end
      portfolio.portfolio_skills.reset # callers read the saved rows, never a stale list
    end
  end
end
