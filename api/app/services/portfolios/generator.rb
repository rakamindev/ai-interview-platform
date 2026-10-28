# frozen_string_literal: true

module Portfolios
  # N10: Generates a structured skill portfolio from the full transcript
  # and final coverage map using Gemini Pro.
  # Runs post-session as a background job.
  class Generator
    GEMINI_TIMEOUT = 180 # seconds; up to 3 minutes for large transcripts
    # A claim older than this is treated as abandoned (a job killed mid-run).
    # Faraday does not retry POST requests, so one model call is bounded by
    # GEMINI_TIMEOUT; twice that leaves room for prompt building and the write.
    CLAIM_TIMEOUT = (2 * GEMINI_TIMEOUT).seconds

    def initialize(session:, gemini_client: nil)
      @session = session
      @gemini_client = gemini_client || Gemini::HttpClient.new(
        model:   ENV.fetch('GEMINI_PRO_MODEL', 'gemini-2.0-pro-001'),
        timeout: GEMINI_TIMEOUT
      )
    end

    # Raised for model output that cannot be used; carries the error code.
    class OutputError < StandardError
      attr_reader :code

      def initialize(code)
        @code = code
        super(code)
      end
    end

    # Worth a Sidekiq retry; the others will fail the same way again.
    RETRYABLE_CODES = %w[timeout rate_limited provider_unavailable unknown].freeze

    # Returns the Portfolio record with skills populated. If another job is
    # already generating this portfolio, returns it untouched.
    def call
      portfolio = @session.portfolio || @session.create_portfolio!(
        candidate_id:      @session.candidate_id,
        generation_status: 'pending'
      )
      return portfolio unless claim(portfolio)

      response = @gemini_client.generate_content(build_prompt, temperature: 0.2)
      save_skills(portfolio, parse_output(response))

      Rails.logger.info("[N10] Portfolio generated for session #{@session.id}")
      portfolio.reload
    rescue StandardError => e
      fail_generation(portfolio, e)
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

        0. CHECK COVERAGE FIRST
           Only rate skills whose coverage state is "partial" or "covered".
           For a skill whose state is "not_yet" or "initiated", return "level": null
           and an empty evidence list. Never guess a level for a skill that was not probed.
           If no candidate quote supports a level, return "level": null.

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

        Confidence is computed by the system from the coverage map; do not return it.

        OUTPUT (JSON only, no prose):
        {
          "configured_skills": [
            {
              "skill_id": "sk-eng-001",
              "skill_label": "React / Frontend Development",
              "level": 3,
              "evidence": ["quote 1", "quote 2", "quote 3"],
              "competency_summary": "2-3 sentence summary"
            }
          ],
          "discovered_skills": [
            {
              "skill_label": "Micro-frontend Architecture",
              "level": null,
              "evidence": [],
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

    # Only one job may generate a portfolio at a time (AC-13). The claim is a
    # single atomic UPDATE; a "generating" claim older than CLAIM_TIMEOUT, or one
    # without a timestamp, was left by a job that died and can be taken over.
    def claim(portfolio)
      now = Time.current
      claimable = Portfolio.where(id: portfolio.id).where(
        "generation_status <> 'generating' OR generation_claimed_at IS NULL OR generation_claimed_at < ?",
        now - CLAIM_TIMEOUT
      )
      claimed = claimable.update_all(generation_status: 'generating', generation_claimed_at: now) == 1
      Rails.logger.info("[N10] Portfolio #{portfolio.id} is already generating, skipped") unless claimed
      claimed
    end

    def parse_output(response)
      raise OutputError, 'empty_output' if response.nil? || (response.is_a?(String) && response.strip.empty?)

      data = response.is_a?(Hash) ? response : JSON.parse(response)
      raise OutputError, 'invalid_output' unless data.is_a?(Hash) && data['configured_skills'].is_a?(Array)

      data
    rescue JSON::ParserError
      raise OutputError, 'invalid_output'
    end

    # Validates every entry first, then updates the skills and completes the
    # portfolio in one transaction, so a failure never leaves a partial write.
    def save_skills(portfolio, data)
      maps  = @session.coverage_maps.to_a
      rows  = normalize_entries(data['configured_skills'], maps, discovered: false)
      rows += normalize_entries(data['discovered_skills'], maps, discovered: true)

      Portfolio.transaction do
        upsert_skills(portfolio, unique_by_key(rows))
        portfolio.update!(generation_status: 'complete', generated_at: Time.current, ratings_validated: true,
                          generation_error: nil, generation_error_code: nil)
      end
    end

    # Skills are matched by a stable key and updated in place, so assessor
    # overrides and their history survive regeneration (AC-24). A skill the
    # model no longer returns is kept as not assessed when an assessor has
    # overridden it (AC-25), and removed otherwise.
    def upsert_skills(portfolio, rows)
      existing = portfolio.portfolio_skills.includes(:assessor_override).index_by { |s| [s.is_discovered, s.skill_key] }

      rows.each do |key, attributes|
        skill = existing.delete(key) || portfolio.portfolio_skills.build
        skill.update!(attributes)
      end

      existing.each_value do |skill|
        if skill.assessor_override
          skill.update!(rating_status: 'not_assessed', not_assessed_reason: 'not_covered', ai_level: nil,
                        ai_confidence: nil, evidence: [], coverage_state: nil, probe_count: nil)
        else
          skill.destroy!
        end
      end
    end

    # The model may repeat a skill; the first entry wins.
    def unique_by_key(rows)
      rows.each_with_object({}) do |attributes, by_key|
        key = [attributes[:is_discovered],
               PortfolioSkill.key_for(skill_id: attributes[:skill_id], skill_label: attributes[:skill_label])]
        by_key[key] ||= attributes
      end
    end

    def normalize_entries(entries, maps, discovered:)
      return [] unless entries.is_a?(Array)

      entries.filter_map do |entry|
        attributes = RatingNormalizer.call(entry, coverage: coverage_for(entry, maps, discovered))
        attributes&.merge(is_discovered: discovered, skill_id: discovered ? nil : attributes[:skill_id])
      end
    end

    def coverage_for(entry, maps, discovered)
      return nil unless entry.is_a?(Hash)

      skill_id = entry['skill_id'].presence
      label    = entry['skill_label'].to_s.strip.downcase
      same_kind = maps.select { |map| map.is_discovered == discovered }

      [same_kind, maps].each do |candidates|
        match = candidates.find { |map| skill_id && map.skill_id == skill_id } ||
                candidates.find { |map| map.skill_label.to_s.strip.downcase == label }
        return match if match
      end
      nil
    end

    # Stores a safe error code and the exception class only: provider messages
    # and bodies can echo prompt or transcript content (UU PDP), so they are
    # never stored, logged or shown.
    def fail_generation(portfolio, error)
      code = error_code(error)
      portfolio&.update_columns(generation_status: 'failed', generation_error_code: code,
                                generation_error: error.class.name)
      status = error.respond_to?(:status) && error.status ? " status=#{error.status}" : ''
      Rails.logger.error("[N10] Portfolio generation failed for session #{@session.id}: " \
                         "code=#{code} error=#{error.class.name}#{status}")
      raise error if portfolio.nil? || RETRYABLE_CODES.include?(code)

      portfolio
    end

    def error_code(error)
      error.is_a?(OutputError) ? error.code : Gemini::ErrorCode.for(error)
    end
  end
end
