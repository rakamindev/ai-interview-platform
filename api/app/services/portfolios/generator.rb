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

    # Raised when the model output cannot be turned into a usable portfolio.
    # The message is fixed text on purpose: it is stored and shown to assessors,
    # so it must never echo model output (which contains candidate quotes).
    class InvalidOutput < StandardError; end

    # Returns the Portfolio record with skills populated.
    #
    # Safe to run more than once for the same session (Sidekiq may deliver or retry a job twice):
    # a finished portfolio is returned untouched, because it may already carry assessor overrides.
    def call
      portfolio = @session.portfolio || @session.create_portfolio!(
        candidate_id:      @session.candidate_id,
        generation_status: 'pending'
      )

      if portfolio.complete?
        Rails.logger.info("[N10] Portfolio for session #{@session.id} already complete, skipping")
        return portfolio
      end

      portfolio.update!(generation_status: 'generating')

      prompt   = build_prompt
      response = @gemini_client.generate_content(prompt, temperature: 0.2)
      rows     = usable_skill_rows(parse_output(response))

      raise InvalidOutput, 'The model returned no usable skills' if rows.empty?

      # All-or-nothing: skills and the "complete" status are saved together or not at all.
      Portfolio.transaction do
        portfolio.lock! # re-reads the row; another job may have finished while we waited for the model
        unless portfolio.complete?
          replace_skills(portfolio, rows)
          portfolio.update!(generation_status: 'complete', generated_at: Time.current)
        end
      end

      Rails.logger.info("[N10] Portfolio generated for session #{@session.id}")
      portfolio
    rescue => e
      mark_failed(portfolio, e)
      Rails.logger.error("[N10] Portfolio generation failed for session #{@session.id}: #{e.class}")
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

    def parse_output(response)
      data = response.is_a?(String) ? JSON.parse(response) : response
      raise InvalidOutput, 'The model output is not a JSON object' unless data.is_a?(Hash)

      data
    rescue JSON::ParserError
      raise InvalidOutput, 'The model output is not valid JSON'
    end

    # Turns the model output into rows that are safe to save. A skill without a valid
    # level stays "not assessed" (no row), instead of being stored as L1 and shown as a gap.
    def usable_skill_rows(data)
      rows    = []
      skipped = 0

      { false => 'configured_skills', true => 'discovered_skills' }.each do |discovered, key|
        Array(data[key]).each do |skill_data|
          row = skill_row(skill_data, discovered: discovered)
          row ? rows << row : skipped += 1
        end
      end

      Rails.logger.warn("[N10] Skipped #{skipped} unusable skill(s) for session #{@session.id}") if skipped.positive?
      rows.uniq { |row| [row[:skill_id], row[:skill_label].downcase] }
    end

    def skill_row(skill_data, discovered:)
      return nil unless skill_data.is_a?(Hash)

      level   = parse_level(skill_data['level'])
      label   = skill_data['skill_label'].to_s.strip
      summary = skill_data['competency_summary'].to_s.strip
      return nil unless level&.between?(1, 5) && label.present? && summary.present?

      confidence = skill_data['confidence'].to_s.downcase
      confidence = 'low' unless PortfolioSkill::CONFIDENCE_LEVELS.include?(confidence)

      {
        skill_id:           discovered ? nil : skill_data['skill_id'],
        skill_label:        label,
        is_discovered:      discovered,
        ai_level:           level,
        ai_confidence:      confidence,
        evidence:           Array(skill_data['evidence']).map { |quote| quote.to_s.strip }.reject(&:empty?).first(3),
        competency_summary: summary
      }
    end

    # Accepts a whole number, as a number or a string ("4"). Anything else, including 2.5,
    # is a malformed answer from the model: truncating it to 2 would invent a level.
    def parse_level(value)
      case value
      when Integer then value
      when String  then Integer(value.strip, 10, exception: false)
      end
    end

    # Runs inside the transaction in #call. Only reached for a portfolio that is not complete,
    # so no assessor override can be lost here.
    def replace_skills(portfolio, rows)
      portfolio.portfolio_skills.destroy_all
      rows.each { |attributes| portfolio.portfolio_skills.create!(attributes) }
    end

    # Never overwrite a portfolio that a parallel job finished in the meantime.
    def mark_failed(portfolio, error)
      return unless portfolio

      portfolio.reload
      return if portfolio.complete?

      portfolio.update!(generation_status: 'failed', generation_error: safe_error_message(error))
    end

    # Raw exception messages can echo model output or SQL values, i.e. candidate data (UU PDP).
    def safe_error_message(error)
      return error.message if error.is_a?(InvalidOutput)

      "Portfolio generation failed (#{error.class.name}). Please regenerate or contact support."
    end
  end
end
