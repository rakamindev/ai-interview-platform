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

    # Returns the Portfolio record with skills populated.
    def call
      portfolio = @session.portfolio || @session.create_portfolio!(
        candidate_id:      @session.candidate_id,
        generation_status: 'pending'
      )

      # Duplicate job (e.g. end_session enqueued twice): a finished portfolio is
      # only rebuilt through the explicit regenerate endpoint, which resets it to failed.
      if portfolio.complete?
        Rails.logger.info("[N10] Portfolio for session #{@session.id} already complete — skipping duplicate job")
        return portfolio
      end

      portfolio.update!(generation_status: 'generating')

      prompt   = build_prompt
      response = @gemini_client.generate_content(prompt, temperature: 0.2)

      save_skills(portfolio, response)
      portfolio.update!(generation_status: 'complete', generated_at: Time.current)

      Rails.logger.info("[N10] Portfolio generated for session #{@session.id}")
      portfolio
    rescue => e
      # reload first: after a rolled-back save_skills the association still holds
      # the unsaved rows, and update! would autosave them back into the table.
      portfolio&.reload&.update!(generation_status: 'failed', generation_error: e.message)
      Rails.logger.error("[N10] Portfolio generation failed for session #{@session.id}: #{e.class} #{e.message}")
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

    # Replaces the portfolio's skills with the model output in one transaction,
    # so a bad row from the model can never leave a half-written portfolio or
    # wipe assessor overrides without restoring them.
    def save_skills(portfolio, response)
      data = response.is_a?(Hash) ? response : JSON.parse(response)
      raise ArgumentError, 'Model response is not a JSON object' unless data.is_a?(Hash)

      unprobed = unprobed_skill_keys

      # requires_new: roll back via a savepoint even when called inside an outer transaction
      ActiveRecord::Base.transaction(requires_new: true) do
        existing_overrides = snapshot_overrides(portfolio)

        # Destroy existing skills (idempotent regeneration)
        portfolio.portfolio_skills.destroy_all

        Array(data['configured_skills']).each do |skill_data|
          next unless skill_data.is_a?(Hash)

          key = skill_key(skill_data['skill_id'], skill_data['skill_label'])
          # A skill the interview never reached has no evidence. Leaving it out
          # makes the fit/gap report say "not assessed" instead of an invented L1.
          next if key.nil? || unprobed.include?(key)

          create_skill(portfolio, skill_data, discovered: false, override: existing_overrides[key])
        end

        Array(data['discovered_skills']).each do |skill_data|
          next unless skill_data.is_a?(Hash)

          key = skill_key(nil, skill_data['skill_label'])
          next if key.nil?

          create_skill(portfolio, skill_data, discovered: true, override: existing_overrides[key])
        end
      end
    end

    def create_skill(portfolio, skill_data, discovered:, override:)
      skill = portfolio.portfolio_skills.create!(
        skill_id:           discovered ? nil : skill_data['skill_id'].presence,
        skill_label:        skill_data['skill_label'].to_s.strip,
        is_discovered:      discovered,
        ai_level:           normalize_level(skill_data['level']),
        ai_confidence:      normalize_confidence(skill_data['confidence']),
        evidence:           Array(skill_data['evidence']).map(&:to_s).reject(&:blank?).first(3),
        competency_summary: skill_data['competency_summary'].presence ||
                            'No competency summary was returned by the model. Review the evidence before relying on this rating.'
      )
      return skill unless override

      skill.create_assessor_override!(override.merge(ai_level: skill.ai_level))
      skill
    end

    def snapshot_overrides(portfolio)
      portfolio.portfolio_skills.includes(:assessor_override).each_with_object({}) do |ps, acc|
        ov  = ps.assessor_override
        key = skill_key(ps.skill_id, ps.skill_label)
        next unless ov && key

        acc[key] = ov.slice(:override_level, :assessor_notes, :overridden_by, :overridden_at).symbolize_keys
      end
    end

    # Configured skills whose coverage never left `not_yet`.
    def unprobed_skill_keys
      @session.coverage_maps
              .reject(&:is_discovered)
              .select { |m| m.state == 'not_yet' && m.probe_count.to_i.zero? }
              .map { |m| skill_key(m.skill_id, m.skill_label) }
              .compact
              .to_set
    end

    def skill_key(skill_id, skill_label)
      skill_id.presence || skill_label.to_s.strip.downcase.presence
    end

    def normalize_level(level)
      # Accepts 3, "3", "L3" or 3.0 — the model is not strict about the type.
      level.to_s[/\d+/]&.to_i&.clamp(1, 5) || 1
    end

    def normalize_confidence(confidence)
      value = confidence.to_s.downcase
      PortfolioSkill::CONFIDENCE_LEVELS.include?(value) ? value : 'low'
    end
  end
end
