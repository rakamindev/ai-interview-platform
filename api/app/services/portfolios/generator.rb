# frozen_string_literal: true

module Portfolios
  # N10: Generates a structured skill portfolio from the full transcript
  # and final coverage map using Gemini Pro.
  # Runs post-session as a background job.
  class Generator
    # A run that has not reported back within this window is treated as
    # dead: the longest HTTP budget (180s + one retry with backoff) stays
    # well under it, while a worker that was SIGKILLed stops blocking the
    # portfolio forever.
    STALE_AFTER = 15.minutes

    def initialize(session:, gemini_client: nil)
      @session = session
      @gemini_client = gemini_client || Gemini.client(:portfolio)
    end

    # Returns the Portfolio record with skills populated.
    def call
      portfolio = @session.portfolio || @session.create_portfolio!(
        candidate_id:      @session.candidate_id,
        generation_status: 'pending'
      )

      # Duplicate Sidekiq deliveries must not run the model twice: the first
      # worker owns the row until it finishes, fails, or goes stale.
      return portfolio unless claim!(portfolio)

      prompt   = build_prompt
      response = @gemini_client.generate_content(prompt, temperature: 0.2)

      save_skills(portfolio, response)
      portfolio.update!(generation_status: 'complete', generated_at: Time.current)

      Rails.logger.info("[N10] Portfolio generated for session #{@session.id}")
      portfolio
    rescue => e
      # Never let a failure message reach an assessor unfiltered: it is
      # stored and rendered, so it carries class/structure only.
      safe_error = Gemini::Config.safe_message(e)
      # update_columns: this must land even when the in-memory row already
      # holds 'failed', where a plain update would find no dirty attribute
      # and write nothing.
      portfolio&.update_columns(generation_status: 'failed', generation_error: safe_error)
      Rails.logger.error("[N10] Portfolio generation failed for session #{@session.id}: #{safe_error}")
      raise
    end

    private

    # Atomic claim: one UPDATE with a WHERE so two workers racing on the
    # same portfolio can never both win. Returns false when another run
    # still holds a fresh claim.
    def claim!(portfolio)
      now = Time.current
      claimable = Portfolio.where(id: portfolio.id).where(
        "generation_status <> 'generating' OR generation_started_at IS NULL OR generation_started_at < ?",
        STALE_AFTER.ago
      )

      claimed = claimable.update_all(generation_status: 'generating', generation_started_at: now)
      if claimed.zero?
        Rails.logger.info("[N10] Portfolio generation already in progress for session #{@session.id} — skipping duplicate run")
        return false
      end

      # update_all bypasses this instance, so re-read it. Without the reload
      # the row is left with stale dirty attributes and a later
      # update(generation_status: 'failed') would compare against the old
      # value, drop the change, and silently leave the row on 'generating'.
      portfolio.reload
      true
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
      rows = build_skill_rows(portfolio, response)

      if rows.empty? && expected_skill_labels.any?
        raise Gemini::Errors::InvalidResponseError,
              "Gemini returned no skill ratings for #{expected_skill_labels.length} covered skill(s)"
      end

      # One transaction: the previous portfolio survives intact if any new row
      # fails to save, so a half-written portfolio is never observable.
      ActiveRecord::Base.transaction do
        portfolio.portfolio_skills.destroy_all
        rows.each(&:save!)
      end

      # Completion is judged against the skills the interview actually covered.
      # Partial output is persisted (so an assessor can still read it) and the
      # caller's rescue then marks the portfolio failed instead of complete.
      missing = unrated_skills(rows)
      return if missing.empty?

      raise Gemini::Errors::InvalidResponseError,
            "Gemini rated #{rows.count { |row| !row.is_discovered }} of #{expected_skill_labels.length} covered " \
            "skill(s); not rated: #{missing.join(', ')}"
    end

    # Skill labels from the coverage map, canonically compared only.
    def expected_skill_labels
      @expected_skill_labels ||= @session.coverage_maps.reject(&:is_discovered).map { |m| canon(m.skill_label) }
    end

    def canon(text)
      text.to_s.downcase.gsub(/[^a-z0-9]+/, ' ').strip
    end

    def unrated_skills(rows)
      rated = rows.reject(&:is_discovered).map { |row| canon(row.skill_label) }.select(&:present?)

      expected_skill_labels.reject do |label|
        # A model that paraphrases a label still counts as covering it, as long
        # as the coverage label appears in what it returned.
        rated.any? { |value| value == label || value.include?(label) || label.include?(value) }
      end
    end

    def build_skill_rows(portfolio, response)
      data = coerce_json(response)

      configured = Array(data['configured_skills'])
      discovered = Array(data['discovered_skills'])

      if configured.empty? && discovered.empty?
        raise Gemini::Errors::InvalidResponseError, 'Gemini returned a portfolio with no skills at all'
      end

      configured.map { |raw| build_skill_row(portfolio, raw, discovered: false) } +
        discovered.map { |raw| build_skill_row(portfolio, raw, discovered: true) }
    end

    def coerce_json(response)
      return response if response.is_a?(Hash)

      begin
        JSON.parse(response.to_s)
      rescue JSON::ParserError
        raise Gemini::Errors::InvalidResponseError,
              "Gemini portfolio payload was not JSON (#{response.to_s.length} characters)"
      end
    end

    # Validates one skill before anything is written. Every message is about
    # structure (label, level, confidence) and never quotes the transcript.
    def build_skill_row(portfolio, raw, discovered:)
      unless raw.is_a?(Hash)
        raise Gemini::Errors::InvalidResponseError,
              "A #{discovered ? 'discovered' : 'configured'} skill entry was #{raw.class}, expected an object"
      end

      label = raw['skill_label'].to_s.strip
      if label.empty?
        raise Gemini::Errors::InvalidResponseError,
              "A #{discovered ? 'discovered' : 'configured'} skill entry arrived with no skill_label"
      end

      level = parse_level(raw['level'])
      unless level
        raise Gemini::Errors::InvalidResponseError,
              "Skill '#{label}' has invalid level #{raw['level'].inspect} (expected an integer from 1 to 5)"
      end

      confidence = raw['confidence'].to_s.strip.downcase
      unless PortfolioSkill::CONFIDENCE_LEVELS.include?(confidence)
        raise Gemini::Errors::InvalidResponseError,
              "Skill '#{label}' has invalid confidence #{raw['confidence'].inspect} " \
              "(expected #{PortfolioSkill::CONFIDENCE_LEVELS.join(', ')})"
      end

      summary = raw['competency_summary'].to_s.strip
      if summary.empty?
        raise Gemini::Errors::InvalidResponseError,
              "Skill '#{label}' arrived without a competency summary"
      end

      evidence = Array(raw['evidence']).select { |quote| quote.is_a?(String) && quote.strip.present? }

      PortfolioSkill.new(
        portfolio_id:      portfolio.id,
        skill_id:          discovered ? nil : raw['skill_id'].to_s.presence,
        skill_label:       label,
        is_discovered:     discovered,
        ai_level:          level,
        ai_confidence:     confidence,
        evidence:          evidence.first(3),
        competency_summary: summary
      )
    end

    # Accepts 3, "3", 3.0, "3.0" — and nothing outside 1..5, so a nonsense
    # model answer surfaces as a failed generation instead of a distorted
    # rating that was silently clamped.
    def parse_level(raw)
      level = case raw
              when Integer then raw
              when Numeric then raw.to_i
              else Integer(raw.to_s, exception: false)
              end
      return nil unless level&.between?(1, 5)

      level
    end
  end
end
