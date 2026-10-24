# frozen_string_literal: true

module Portfolios
  # N10: Generates a structured skill portfolio from the full transcript
  # and final coverage map using Gemini Pro.
  # Runs post-session as a background job.
  class Generator
    class StaleGeneration < StandardError; end

    def initialize(session:, gemini_client: nil, request_token: nil)
      @session = session
      @gemini_client = gemini_client
      @request_token = request_token
    end

    # Returns the Portfolio record with skills populated.
    def call
      portfolio = @session.portfolio || @session.create_portfolio!(
        candidate_id:      @session.candidate_id,
        generation_status: 'pending'
      )
      had_complete_portfolio = portfolio.complete?

      if @request_token
        return portfolio unless portfolio.generation_attempt_token == @request_token
      else
        portfolio.update!(generation_status: 'generating') unless had_complete_portfolio
      end

      prompt   = build_prompt
      client = @gemini_client || Gemini::HttpClient.new(
        model: ENV.fetch('GEMINI_PRO_MODEL', 'gemini-2.0-pro-001'), timeout: 180
      )
      response = client.generate_content(prompt, temperature: 0.2)
      rows = Portfolios::ResponseValidator.new(
        response: response,
        configured_skills: @session.assessment.assessment_skills,
        candidate_turns: @session.transcript_turns.where(speaker: 'candidate').pluck(:text)
      ).call

      Portfolio.transaction do
        portfolio.lock!
        raise StaleGeneration if @request_token && portfolio.generation_attempt_token != @request_token

        existing_skills = portfolio.portfolio_skills.includes(:assessor_override).to_a
        matched_ids = []

        rows.each do |attributes|
          existing = existing_skills.find { |skill| skill_identity(skill) == skill_identity(attributes) }
          if existing
            existing.update!(attributes)
            matched_ids << existing.id
          else
            portfolio.portfolio_skills.create!(attributes)
          end
        end

        existing_skills.reject { |skill| matched_ids.include?(skill.id) }.each do |skill|
          raise ArgumentError, 'Regeneration omitted an overridden skill' if skill.assessor_override

          skill.destroy!
        end
        portfolio.update!(generation_status: 'complete', generation_error: nil,
                          generation_attempt_token: nil, generated_at: Time.current)
      end

      Rails.logger.info("[N10] Portfolio generated for session #{@session.id}")
      portfolio
    rescue StaleGeneration
      portfolio
    rescue => e
      portfolio&.with_lock do
        if @request_token.nil? || portfolio.generation_attempt_token == @request_token
          portfolio.update!(generation_status: had_complete_portfolio ? 'complete' : 'failed',
                            generation_attempt_token: nil, generation_error: e.class.name)
        end
      end
      Rails.logger.error("[N10] Portfolio generation failed for session #{@session.id}: #{e.class}")
      raise
    end

    private

    def skill_identity(skill)
      id = skill.is_a?(Hash) ? skill[:skill_id] : skill.skill_id
      label = skill.is_a?(Hash) ? skill[:skill_label] : skill.skill_label
      discovered = skill.is_a?(Hash) ? skill[:is_discovered] : skill.is_discovered
      [discovered, id.present? ? id.to_s.strip.upcase : label.to_s.squish.downcase]
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

  end
end
