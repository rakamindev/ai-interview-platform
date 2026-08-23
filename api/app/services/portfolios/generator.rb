# frozen_string_literal: true

module Portfolios
  # N10: Generates a structured skill portfolio from the full transcript
  # and final coverage map using Gemini Pro.
  # Runs post-session as a background job.
  class Generator
    # Raised when the model's response cannot be trusted enough to replace
    # the portfolio that already exists. Carries no model output, so it is
    # safe to persist and log.
    class UnusableResponse < StandardError; end

    NEUTRAL_SUMMARY = 'No competency summary was returned for this skill.'

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

      # Row lock: PortfolioGeneratorWorker retries and the regenerate endpoint
      # can both be in flight for one session. Two generators interleaving
      # around the delete-and-rewrite below would corrupt the skill set.
      portfolio.with_lock do
        portfolio.update!(generation_status: 'generating')

        prompt   = build_prompt
        response = @gemini_client.generate_content(prompt, temperature: 0.2)

        # Parse and validate *before* touching anything already persisted.
        skills = parse_skills(response)
        save_skills(portfolio, skills)

        portfolio.update!(generation_status: 'complete', generated_at: Time.current, generation_error: nil)
      end

      Rails.logger.info("[N10] Portfolio generated for session #{@session.id}")
      portfolio
    rescue StandardError => e
      reason = safe_error_reason(e)
      portfolio&.update_columns(generation_status: 'failed', generation_error: reason)
      Rails.logger.error("[N10] Portfolio generation failed for session #{@session.id}: #{reason}")
      raise
    end

    private

    # ── Failure reporting ──────────────────────────────────────────────────
    #
    # The previous implementation persisted and logged `e.message` verbatim.
    # A JSON::ParserError message embeds the fragment of the document it
    # choked on, and that document is the model's reading of the candidate's
    # interview — their words. That put candidate personal data into
    # application logs and into a DB column that the API hands back to any
    # assessor, which UU PDP does not permit for this purpose.
    #
    # Failure reporting only needs to tell an operator what to do next, so we
    # map to a fixed vocabulary and never interpolate untrusted text.
    def safe_error_reason(error)
      case error
      when UnusableResponse
        error.message
      when JSON::ParserError
        'The model returned a response that was not valid JSON.'
      when ActiveRecord::RecordInvalid
        # Our own validation text, about our own schema — no model output.
        "Generated skills failed validation: #{error.record.errors.full_messages.take(3).join('; ')}"
      when Faraday::TimeoutError, Net::ReadTimeout
        'The model did not respond within the timeout.'
      when Faraday::Error
        'The model request failed.'
      else
        "Generation failed (#{error.class.name})."
      end
    end

    # ── Response handling ──────────────────────────────────────────────────

    # Returns normalised skill rows, or raises before any write happens.
    def parse_skills(response)
      data = response.is_a?(Hash) ? response : JSON.parse(response.to_s)

      unless data.is_a?(Hash)
        raise UnusableResponse, 'The model response was not an object.'
      end

      configured = data['configured_skills']
      discovered = data['discovered_skills']

      # Both keys absent means we cannot tell "the model found nothing" from
      # "the model answered a different question". Refusing here is what keeps
      # a malformed response from emptying an existing portfolio.
      if configured.nil? && discovered.nil?
        raise UnusableResponse,
              'The model response contained neither configured_skills nor discovered_skills.'
      end

      rows = Array(configured).map { |s| normalise_skill(s, discovered: false) } +
             Array(discovered).map { |s| normalise_skill(s, discovered: true) }

      rows.compact
    end

    # A skill row the model returned, coerced into something the schema can
    # hold — without inventing a rating that was never assessed.
    def normalise_skill(raw, discovered:)
      return nil unless raw.is_a?(Hash)

      label = raw['skill_label'].presence
      return nil if label.nil?  # unlabelled row is not attributable to anything

      {
        skill_id:           discovered ? nil : raw['skill_id'].presence,
        skill_label:        label.to_s.strip,
        is_discovered:      discovered,
        ai_level:           coerce_level(raw['level']),
        ai_confidence:      coerce_confidence(raw['confidence'], raw['level']),
        evidence:           Array(raw['evidence']).map(&:to_s).first(3),
        competency_summary: raw['competency_summary'].presence || NEUTRAL_SUMMARY
      }
    end

    # nil when the model gave us nothing usable.
    #
    # The previous `level.to_i.clamp(1, 5)` mapped nil, "", "three" and 0 all
    # onto 1 — "executes with explicit guidance, cannot apply independently".
    # A skill the interview never reached became a documented weakness.
    def coerce_level(value)
      return value if value.is_a?(Integer) && value.between?(1, 5)

      # Accept "4" and "L4", reject everything else rather than guessing.
      if value.is_a?(String) && (m = value.match(/\A\s*[Ll]?([1-5])\s*\z/))
        return m[1].to_i
      end

      nil
    end

    # An unrated skill cannot carry a confidence in its rating. Anything else
    # we do not recognise degrades to the most conservative value rather than
    # failing the whole batch.
    def coerce_confidence(value, level)
      return 'low' if coerce_level(level).nil?

      normalised = value.to_s.strip.downcase
      PortfolioSkill::CONFIDENCE_LEVELS.include?(normalised) ? normalised : 'low'
    end

    # ── Persistence ────────────────────────────────────────────────────────

    def save_skills(portfolio, rows)
      # One transaction around delete-and-rewrite. Previously destroy_all ran
      # first and create! could raise afterwards, leaving the portfolio empty
      # and marked failed — and because the worker retries three times, a
      # consistently malformed response wiped it four times over.
      PortfolioSkill.transaction do
        preserved = capture_overrides(portfolio)

        portfolio.portfolio_skills.destroy_all

        rows.each do |attrs|
          skill = portfolio.portfolio_skills.create!(attrs)
          restore_override(skill, preserved)
        end
      end
    end

    # assessor_overrides are cascaded away by destroy_all, so a regeneration
    # silently discarded the one judgement in this system a human actually
    # made. We carry them across, keyed by the same identity the fit/gap
    # engine matches on.
    def capture_overrides(portfolio)
      portfolio.portfolio_skills.includes(:assessor_override).each_with_object({}) do |skill, acc|
        override = skill.assessor_override
        next if override.nil?

        acc[override_key(skill.skill_id, skill.skill_label)] = override.attributes.slice(
          'ai_level', 'override_level', 'assessor_notes', 'overridden_by', 'overridden_at'
        )
      end
    end

    def restore_override(skill, preserved)
      attrs = preserved[override_key(skill.skill_id, skill.skill_label)]
      return if attrs.nil?

      # ai_level is kept as it was when the assessor made the call. If the new
      # model run disagrees with that recorded value the override is stale,
      # and keeping the original is what makes that detectable downstream —
      # overwriting it would erase the fact that a human was overruling
      # something specific.
      skill.create_assessor_override!(attrs)
    end

    def override_key(skill_id, skill_label)
      skill_id.presence&.downcase || skill_label.to_s.strip.downcase
    end

    # ── Prompt ─────────────────────────────────────────────────────────────

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

           If the transcript does not contain enough evidence to place the
           candidate against the anchors, return "level": null. Do NOT guess and
           do NOT default to 1 — an unassessed skill and a weak skill are
           different findings and must not be reported as the same thing.

        3. WRITE THE COMPETENCY SUMMARY
           2-3 sentences. Focus on patterns, not individual answers.
           What does this person reliably do at this skill? What's the ceiling? What's missing?
           If level is null, say what was missing rather than characterising ability.

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
