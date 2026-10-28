# frozen_string_literal: true

module Portfolios
  # N10: Generates a structured skill portfolio from the full transcript
  # and final coverage map using Gemini Pro.
  # Runs post-session as a background job.
  class Generator
    # The model answered, but not with a JSON object. Raised before anything is written, so the
    # job can be retried safely.
    class UnreadableOutput < StandardError; end

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

      portfolio.update!(generation_status: 'generating', generation_started_at: Time.current,
                        generation_attempts: portfolio.generation_attempts + 1)

      coverage = expected_coverage
      output   = model_needed?(coverage) ? fetch_model_output : {}

      save_skills(portfolio, coverage, output)

      Rails.logger.info("[N10] Portfolio generated for session #{@session.id}")
      portfolio
    rescue => e
      # Stays 'generating' between Sidekiq retries; the worker marks it failed when they run out.
      portfolio&.update!(generation_error: failure_reason(e))
      Rails.logger.error("[N10] Portfolio generation failed for session #{@session.id}: #{e.class} #{e.message}")
      raise
    end

    private

    # Shown to assessors, so it says what happened without exposing raw error text.
    def failure_reason(error)
      case error
      when UnreadableOutput then error.message
      when Gemini::HttpClient::TimeoutError then 'The AI model did not respond in time.'
      when Gemini::HttpClient::RateLimitError then 'The AI model is rate limited (HTTP 429).'
      when Gemini::HttpClient::ApiError
        case error.status
        when 404 then 'The AI model is not available (HTTP 404). Check the configured model name.'
        when 500..599 then "The AI model is overloaded (HTTP #{error.status})."
        else "The AI model returned an error#{" (HTTP #{error.status})" if error.status}."
        end
      else "Unexpected error (#{error.class.name})."
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

    # The skills a portfolio must list are the ones the interview tracked, not whatever the model
    # chose to return. Falls back to the assessment's skills (all never discussed) when the session
    # ended before coverage tracking started.
    def expected_coverage
      maps = @session.coverage_maps.order(:id).to_a
      return maps if maps.any?

      @session.assessment.assessment_skills.order(:display_order).map do |skill|
        CoverageMap.new(skill_id: skill.skill_id, skill_label: skill.skill_label, is_discovered: false,
                        state: 'not_yet', probe_count: 0)
      end
    end

    # Only spend a model call when there is something to rate.
    def model_needed?(coverage)
      candidate_spoke? && coverage.any? { |row| row.state != 'not_yet' }
    end

    def candidate_spoke?
      @candidate_spoke ||= @session.transcript_turns.where(speaker: 'candidate').exists?
    end

    def fetch_model_output
      raw  = @gemini_client.generate_content(build_prompt, temperature: 0.2)
      data = raw.is_a?(String) ? JSON.parse(raw) : raw
      raise UnreadableOutput, 'The AI returned a response that is not a JSON object.' unless data.is_a?(Hash)

      data
    rescue JSON::ParserError
      raise UnreadableOutput, 'The AI returned a response that is not valid JSON.'
    end

    # Writes every skill in one transaction, updating rows in place so assessor overrides survive.
    # The row lock serialises two jobs generating the same portfolio. requires_new makes this a
    # savepoint, so these writes are undone on failure even if a caller has opened a transaction
    # and rescues the error (a joined transaction would leave them to the caller's outcome).
    def save_skills(portfolio, coverage, output)
      rows = candidate_spoke? ? coverage : coverage.map { |row| not_discussed(row) }

      ActiveRecord::Base.transaction(requires_new: true) do
        portfolio.lock!
        existing = portfolio.portfolio_skills.includes(:assessor_override).to_a

        match_entries(rows, output).each do |row, entry|
          attrs = SkillNormalizer.call(coverage: row, entry: entry)
          skill = existing.find { |s| same_skill?(s, attrs) }
          existing.delete(skill)
          # Not portfolio.portfolio_skills.build: a built record stays in the association, and the
          # failure path's portfolio.update! would autosave it outside this transaction.
          skill ||= PortfolioSkill.new(portfolio_id: portfolio.id)
          skill.assign_attributes(attrs)
          skill.save!
        end

        # Skills no longer in the coverage map go away, unless an assessor has reviewed them.
        existing.reject(&:assessor_override).each(&:destroy!)

        portfolio.update!(generation_status: 'complete', generated_at: Time.current)
      end
    end

    def not_discussed(row)
      CoverageMap.new(skill_id: row.skill_id, skill_label: row.skill_label, is_discovered: row.is_discovered,
                      state: 'not_yet', probe_count: 0)
    end

    # Pairs each coverage row with at most one model entry: by skill_id (any case), then by label.
    # Entries that match nothing, or repeat a skill, are ignored. Only the count is logged, never
    # their content, because it is about a candidate.
    def match_entries(rows, output)
      pools = { false => model_entries(output, 'configured_skills'), true => model_entries(output, 'discovered_skills') }
      used  = []

      pairs = rows.map do |row|
        pool  = pools[row.is_discovered].reject { |e| used.any? { |u| u.equal?(e) } }
        entry = pool.find { |e| same_text?(e['skill_id'], row.skill_id) } ||
                pool.find { |e| same_text?(e['skill_label'], row.skill_label) }
        used << entry if entry
        [row, entry]
      end

      ignored = pools.values.sum(&:size) - used.size
      Rails.logger.info("[N10] Ignored #{ignored} unmatched model skill entries for session #{@session.id}") if ignored.positive?
      pairs
    end

    def model_entries(output, key)
      list = output[key]
      list.is_a?(Array) ? list.grep(Hash) : []
    end

    def same_skill?(skill, attrs)
      return false unless skill.is_discovered == attrs[:is_discovered]

      attrs[:skill_id].present? ? same_text?(skill.skill_id, attrs[:skill_id]) : same_text?(skill.skill_label, attrs[:skill_label])
    end

    def same_text?(a, b)
      a.is_a?(String) && b.is_a?(String) && !a.strip.empty? && a.strip.casecmp?(b.strip)
    end
  end
end
