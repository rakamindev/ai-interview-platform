# frozen_string_literal: true

module Portfolios
  # N10: Generates a structured skill portfolio from the full transcript
  # and final coverage map using Gemini Pro.
  # Runs post-session as a background job.
  class Generator
    class MalformedResponseError < StandardError; end

    # Keep persisted error text short so a model error can never carry transcript
    # content into the database or the logs.
    MAX_ERROR_CHARS = 200

    def initialize(session:, gemini_client: nil)
      @session = session
      @gemini_client = gemini_client || Gemini::HttpClient.new(
        model:   ENV.fetch('GEMINI_PRO_MODEL', 'gemini-2.0-pro-001'),
        timeout: 180  # up to 3 minutes for large transcripts
      )
    end

    # Returns the Portfolio record with skills populated.
    def call
      portfolio = find_or_create_portfolio

      unless claim_for_generation(portfolio)
        Rails.logger.info("[N10] Duplicate job ignored — portfolio #{portfolio.id} is already being generated")
        return portfolio
      end

      response  = @gemini_client.generate_content(build_prompt, temperature: 0.2)
      selection = save_skills(portfolio, response)

      portfolio.update!(
        generation_status: 'complete',
        generated_at:      Time.current,
        generation_error:  nil
      )

      Rails.logger.info(
        "[N10] Portfolio #{portfolio.id} generated for session #{@session.id} " \
        "(saved=#{selection.skills.size} skipped=#{selection.skipped.size})"
      )
      log_skipped(selection)

      portfolio
    rescue StandardError => e
      mark_failed(portfolio, e)
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

    def find_or_create_portfolio
      @session.portfolio || @session.create_portfolio!(
        candidate_id:      @session.candidate_id,
        generation_status: 'pending'
      )
    rescue ActiveRecord::RecordNotUnique
      # Two workers can reach this at the same time for a session that has no
      # portfolio yet. portfolios.session_id is unique, so one of them loses the
      # insert — it should pick up the winner's row, not fail the job.
      @session.reload.portfolio
    end

    # Duplicate-job guard. Sidekiq retries, the EndHandler and a manual regenerate can
    # all enqueue N10 for the same session; without this, two workers would race on
    # destroy_all + create!. The row lock makes the claim atomic, and a `generating`
    # row that is older than STALE_GENERATION_AFTER is reclaimable so a worker killed
    # mid-run can never leave a portfolio stuck on "generating" forever.
    def claim_for_generation(portfolio)
      claimed = false

      portfolio.with_lock do
        if portfolio.generating? && !portfolio.generation_stale?
          claimed = false
        else
          portfolio.update!(
            generation_status:     'generating',
            generation_started_at: Time.current,
            generation_attempts:   portfolio.generation_attempts.to_i + 1,
            generation_error:      nil
          )
          claimed = true
        end
      end

      claimed
    end

    # Replaces the portfolio's skills in a single transaction. Previously the
    # destroy_all and the create! loop ran unprotected, so a record failing halfway
    # through left the portfolio marked `failed` on top of a half-written skill set.
    def save_skills(portfolio, response)
      selection = SkillSelection.call(parse_response(response), coverage_maps: @session.coverage_maps.to_a)

      portfolio.transaction do
        portfolio.portfolio_skills.destroy_all
        selection.skills.each { |payload| portfolio.portfolio_skills.create!(payload.to_attributes) }
      end

      selection
    end

    def parse_response(response)
      return response if response.is_a?(Hash)

      JSON.parse(response.to_s)
    rescue JSON::ParserError
      # The raw body can quote the candidate — never put it in the error we persist.
      raise MalformedResponseError, 'Gemini returned a response that is not valid JSON'
    end

    def log_skipped(selection)
      return if selection.skipped.empty?

      # Skill labels are role metadata, not personal data — safe to log. Evidence
      # quotes and the transcript are not logged anywhere in this class.
      summary = selection.skipped.map { |entry| "#{entry[:skill_label] || '(unlabelled)'}=#{entry[:reason]}" }
      Rails.logger.info("[N10] Skipped #{selection.skipped.size} skill(s) for session #{@session.id}: #{summary.join(', ')}")
    end

    # UU PDP: a raw exception message can embed transcript text or candidate quotes.
    # Persist and log the exception class plus a truncated message only.
    def mark_failed(portfolio, error)
      return if portfolio.nil?

      portfolio.update!(
        generation_status: 'failed',
        generation_error:  "#{error.class}: #{error.message.to_s[0, MAX_ERROR_CHARS]}"
      )
      Rails.logger.error(
        "[N10] Portfolio generation failed session=#{@session.id} " \
        "attempt=#{portfolio.generation_attempts} error=#{error.class}"
      )
    rescue StandardError => e
      Rails.logger.error("[N10] Could not record failure state for session #{@session.id}: #{e.class}")
    end
  end
end
