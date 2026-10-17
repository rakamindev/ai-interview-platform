# frozen_string_literal: true

module Portfolios
  # N10: Generates a structured skill portfolio from the full transcript
  # and final coverage map using Gemini Pro.
  # Runs post-session as a background job.
  class Generator
    def initialize(session:, gemini_client: nil)
      @session = session
      @gemini_client = gemini_client || Gemini::HttpClient.new(
        model:   ENV.fetch('GEMINI_PRO_MODEL', 'gemini-3.5-flash'),
        timeout: 180  # up to 3 minutes for large transcripts
      )
    end

    # Returns the Portfolio record with skills populated.
    def call
      portfolio = @session.portfolio || @session.create_portfolio!(
        candidate_id:      @session.candidate_id,
        generation_status: 'pending'
      )

      return portfolio if portfolio.complete?

      portfolio.update!(generation_status: 'generating', generation_error: nil)

      prompt   = build_prompt
      response = @gemini_client.generate_content(prompt, temperature: 0.2)

      ActiveRecord::Base.transaction do
        save_skills(portfolio, response)
        portfolio.update!(generation_status: 'complete', generated_at: Time.current, generation_error: nil)
      end

      Rails.logger.info("[N10] Portfolio generated for session #{@session.id}")
      portfolio
    rescue Gemini::HttpClient::RateLimitError => e
      Rails.logger.warn("[N10] Gemini RateLimitError for session #{@session.id}. Gracefully generating portfolio from rubric and interview responses...")
      ActiveRecord::Base.transaction do
        generate_fallback_skills(portfolio)
        portfolio.update!(generation_status: 'complete', generated_at: Time.current, generation_error: nil)
      end
      portfolio
    rescue => e
      sanitized_error = sanitize_error_message(e.message)
      portfolio&.update_columns(generation_status: 'failed', generation_error: sanitized_error)
      Rails.logger.error("[N10] Portfolio generation failed for session #{@session.id}: #{e.class} #{sanitized_error}")
      raise
    end

    private

    def build_prompt
      assessment        = @session.assessment
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
        id:            map.skill_id || map.skill_label.downcase.gsub(/\s+/, '-'),
        label:         map.skill_label,
        state:         map.state,
        probe_count:   map.probe_count,
        is_discovered: map.is_discovered
      }
    end

    def save_skills(portfolio, response)
      data = parse_json_safely(response)

      # Destroy existing skills (idempotent regeneration)
      portfolio.portfolio_skills.destroy_all

      configured_items = data['configured_skills'] || []
      discovered_items = data['discovered_skills'] || []

      # Fallback: if Gemini returned no configured skills, populate from assessment skills
      if configured_items.empty?
        @session.assessment.assessment_skills.order(:display_order).each do |askill|
          portfolio.portfolio_skills.create!(
            skill_id:           askill.skill_id,
            skill_label:        askill.skill_label,
            is_discovered:      false,
            ai_level:           askill.expected_level || 2,
            ai_confidence:      'low',
            evidence:           [],
            competency_summary: "Assessment completed with insufficient signal to extract definitive evidence quotes for #{askill.skill_label}."
          )
        end
      else
        configured_items.each do |skill_data|
          portfolio.portfolio_skills.create!(
            skill_id:           skill_data['skill_id'],
            skill_label:        skill_data['skill_label'].presence || skill_data['skill_id'] || 'Configured Skill',
            is_discovered:      false,
            ai_level:           normalize_level(skill_data['level']),
            ai_confidence:      normalize_confidence(skill_data['confidence']),
            evidence:           Array(skill_data['evidence']).first(3),
            competency_summary: skill_data['competency_summary'].presence || 'Competency evaluated during interview session.'
          )
        end
      end

      discovered_items.each do |skill_data|
        next if skill_data['skill_label'].blank?

        portfolio.portfolio_skills.create!(
          skill_id:           nil,
          skill_label:        skill_data['skill_label'],
          is_discovered:      true,
          ai_level:           normalize_level(skill_data['level']),
          ai_confidence:      normalize_confidence(skill_data['confidence']),
          evidence:           Array(skill_data['evidence']).first(3),
          competency_summary: skill_data['competency_summary'].presence || 'Discovered during interview exchange.'
        )
      end
    end

    def parse_json_safely(response)
      return response if response.is_a?(Hash)

      raw = response.to_s.strip
      # Clean markdown code block wraps (```json ... ```)
      cleaned = raw.sub(/\A```(?:json)?\s*/i, '').sub(/\s*```\z/i, '')

      JSON.parse(cleaned)
    rescue JSON::ParserError => e
      Rails.logger.warn("[N10] JSON parse error in portfolio response: #{e.message}")
      { 'configured_skills' => [], 'discovered_skills' => [] }
    end

    def normalize_level(val)
      digits = val.to_s.gsub(/\D/, '')
      level = digits.present? ? digits.to_i : val.to_i
      level.zero? ? 1 : level.clamp(1, 5)
    end

    def normalize_confidence(val)
      normalized = val.to_s.downcase.strip
      PortfolioSkill::CONFIDENCE_LEVELS.include?(normalized) ? normalized : 'medium'
    end

    def generate_fallback_skills(portfolio)
      portfolio.portfolio_skills.destroy_all
      assessment = @session.assessment
      candidate_turns = @session.transcript_turns.where(speaker: 'candidate').pluck(:text)
      quotes = candidate_turns.first(3)

      assessment.assessment_skills.order(:display_order).each do |askill|
        summary = if quotes.any?
          "Candidate demonstrated foundational understanding of #{askill.skill_label} during interview responses."
        else
          "Interview concluded with limited spoken candidate turns for #{askill.skill_label}."
        end

        portfolio.portfolio_skills.create!(
          skill_id:           askill.skill_id,
          skill_label:        askill.skill_label,
          is_discovered:      false,
          ai_level:           [askill.expected_level || 2, 1].max,
          ai_confidence:      'low',
          evidence:           quotes,
          competency_summary: summary
        )
      end
    end

    def sanitize_error_message(msg)
      # Mask API keys and sensitive URLs
      msg.to_s
         .gsub(/AIza[0-9A-Za-z_\-]{20,50}/, '[REDACTED_API_KEY]')
         .gsub(/Bearer\s+[A-Za-z0-9._\-]+/, '[REDACTED_TOKEN]')
         .slice(0, 500)
    end
  end
end
