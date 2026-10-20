# frozen_string_literal: true

module Portfolios
  # N10: Generates a structured skill portfolio from the full transcript
  # and final coverage map using Gemini Pro.
  # Runs post-session as a background job.
  class Generator
    # The model's answer isn't a portfolio. The message is fixed on purpose: the parser's own message quotes
    # the model's text, and Sidekiq logs and stores the message of every failed job (AC-10).
    class InvalidResponse < StandardError
      def initialize(msg = "The model's answer couldn't be read as a portfolio") = super
    end

    # mark_failed: false leaves a failed attempt "generating", for a caller that will try again. The worker passes it,
    # because Sidekiq retries the job and only its retries-exhausted hook knows the portfolio has really failed (P2-26).
    def initialize(session:, gemini_client: nil, mark_failed: true)
      @session = session
      @mark_failed = mark_failed
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

      portfolio.update!(generation_status: 'generating')

      # The model is called before the transaction opens, so a slow call never holds the database.
      response = @gemini_client.generate_content(build_prompt, temperature: 0.2)
      rows     = resolver.call(parse(response))

      # All or nothing: a failure partway leaves the previous skills, and their overrides, as they were (AC-8).
      Portfolio.transaction do
        write_skills(portfolio, rows)
        portfolio.update!(generation_status: 'complete', generated_at: Time.current,
                          generation_error: nil, generation_error_category: nil)
      end

      Rails.logger.info("[N10] Portfolio generated for session #{@session.id}")
      portfolio
    rescue JSON::ParserError
      fail_with(portfolio, 'model_invalid_response', JSON::ParserError)
      raise InvalidResponse
    rescue => e
      fail_with(portfolio, error_category(e), e.class)
      raise
    end

    private

    def parse(response)
      data = response.is_a?(Hash) ? response : JSON.parse(response.to_s)
      raise InvalidResponse unless data.is_a?(Hash) && data['configured_skills'].is_a?(Array)

      data
    end

    def resolver
      SkillResolver.new(
        configured_skills: @session.assessment.assessment_skills.order(:display_order).to_a,
        coverage_maps:     @session.coverage_maps.to_a,
        candidate_texts:   @session.transcript_turns.where(speaker: 'candidate').pluck(:text)
      )
    end

    # Updates rows in place by skill identity, so an assessor's override stays on its skill (AC-9).
    def write_skills(portfolio, rows)
      existing = portfolio.portfolio_skills.includes(:assessor_override).to_a
      kept     = []

      rows.each do |attributes|
        # PortfolioSkill.new rather than the association's build: if the transaction fails, an unsaved row
        # left in the association would be saved along with the portfolio's "failed" status.
        record = existing.find { |skill| !kept.include?(skill) && same_skill?(skill, attributes) } ||
                 PortfolioSkill.new(portfolio_id: portfolio.id)
        record.assign_attributes(attributes)
        record.save!
        kept << record
      end

      (existing - kept).each do |dropped|
        # The model no longer mentions this skill. An assessor's rating of it is kept, not silently deleted.
        if dropped.assessor_override
          Rails.logger.warn("[N10] Kept skill #{dropped.id} for session #{@session.id}: dropped by the model, rated by an assessor")
        else
          dropped.destroy!
        end
      end

      portfolio.portfolio_skills.reset
    end

    def same_skill?(skill, attributes)
      return false unless skill.is_discovered == attributes[:is_discovered]
      return skill.skill_id == attributes[:skill_id] if skill.skill_id.present? && attributes[:skill_id].present?

      skill.skill_label.casecmp?(attributes[:skill_label])
    end

    def fail_with(portfolio, category, error_class)
      # Only the category and the class are logged: the message can quote the model's answer.
      Rails.logger.error("[N10] Portfolio generation failed for session #{@session.id}: #{category} (#{error_class})")
      return unless portfolio&.persisted?

      # The category is kept either way: the retries-exhausted hook builds its message from it.
      if @mark_failed
        portfolio.reload.update!(generation_status: 'failed', generation_error_category: category,
                                 generation_error: Portfolio.generation_error_message(category))
      else
        portfolio.reload.update!(generation_error_category: category)
      end
    end

    def error_category(error)
      case error
      when Gemini::HttpClient::TimeoutError then 'model_timeout'
      when Gemini::HttpClient::ApiError     then 'model_unavailable'
      when InvalidResponse                  then 'model_invalid_response'
      else 'internal_error'
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

        For EACH skill in the coverage map (both configured and discovered). Quote evidence word for word:
        a quote that isn't in the candidate's turns is discarded.

        1. FIND THE EVIDENCE
           Read all transcript turns where this skill was discussed.
           Identify the 2-3 most revealing quotes from the CANDIDATE (not the AI).
           A quote is revealing if it shows HOW they think, not just WHAT they know.

        2. ASSIGN A LEVEL, OR NONE
           Compare the candidate's actual behavior to the L1-L5 anchors.
           Assign the highest level where you see CONSISTENT evidence, not just one strong moment.
           If evidence is mixed (mostly L2 with one L3 moment), assign L2.
           If the skill was never discussed (state not_yet), or the transcript has too little to place it on an
           anchor, answer "level": null with "confidence": null and empty evidence. Never guess a level: a low
           level is a claim about the candidate, and no level means the interview didn't measure it.

        3. WRITE THE COMPETENCY SUMMARY (null when there is no level)
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
            },
            {
              "skill_id": "sk-soft-001",
              "skill_label": "Communication",
              "level": null,
              "confidence": null,
              "evidence": [],
              "competency_summary": null
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
