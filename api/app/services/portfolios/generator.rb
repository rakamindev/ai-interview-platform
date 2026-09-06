# frozen_string_literal: true

module Portfolios
  # N10: Generates a structured skill portfolio from the full transcript
  # and final coverage map using Gemini Pro.
  # Runs post-session as a background job.
  class Generator
    def initialize(session:, gemini_client: nil)
      @session = session
      @gemini_client = gemini_client || Gemini::HttpClient.new(
        model:   ENV.fetch('GEMINI_PRO_MODEL', 'gemini-3.1-pro-preview'),
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

      # If there are no transcript turns, candidate had no interview interaction
      if @session.transcript_turns.empty?
        save_unassessed_skills_for_empty_transcript(portfolio)
        portfolio.update!(generation_status: 'complete', generated_at: Time.current, generation_error: nil)
        Rails.logger.info("[N10] Portfolio generated for session #{@session.id} (empty transcript: all skills marked not_assessed)")
        return portfolio
      end

      prompt   = build_prompt
      response = @gemini_client.generate_content(prompt, temperature: 0.2)

      save_skills(portfolio, response)
      portfolio.update!(generation_status: 'complete', generated_at: Time.current, generation_error: nil)

      Rails.logger.info("[N10] Portfolio generated for session #{@session.id}")
      portfolio
    rescue => e
      portfolio&.update!(generation_status: 'failed', generation_error: e.message)
      Rails.logger.error("[N10] Portfolio generation failed for session #{@session.id}: #{e.class} #{e.message}")
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

        1. CHECK IF ASSESSED
           If coverage state = 'not_yet' OR (probe_count < 2 AND evidence is empty):
           You MUST set "not_assessed": true, "level": null, and "confidence": null.
           NEVER assign a rating/level if the candidate was never questioned or probed on this skill.
           Honesty is mandatory — not_assessed is accurate and fair to the candidate.

        2. FIND THE EVIDENCE (if assessed)
           Read all transcript turns where this skill was discussed.
           Identify the 2-3 most revealing quotes from the CANDIDATE (not the AI).
           A quote is revealing if it shows HOW they think, not just WHAT they know.

        3. ASSIGN A LEVEL (if assessed)
           Compare the candidate's actual behavior to the L1-L5 anchors.
           Assign the highest level where you see CONSISTENT evidence, not just one strong moment.
           If evidence is mixed (mostly L2 with one L3 moment), assign L2.

        4. WRITE THE COMPETENCY SUMMARY
           2-3 sentences. Focus on patterns, not individual answers.
           What does this person reliably do at this skill? What's the ceiling? What's missing?
           If not_assessed: explicitly state that this skill was not probed during the session.

        5. ASSIGN CONFIDENCE (if assessed, null if not_assessed)
           high — probe_count >= 3 AND state = covered
           medium — probe_count = 2 OR state = partial
           low — probe_count <= 1 OR state = initiated

        OUTPUT (JSON only, no prose):
        {
          "configured_skills": [
            {
              "skill_id": "sk-eng-001",
              "skill_label": "React / Frontend Development",
              "not_assessed": false,
              "level": 3,
              "confidence": "high",
              "evidence": ["quote 1", "quote 2", "quote 3"],
              "competency_summary": "2-3 sentence summary"
            },
            {
              "skill_id": "sk-eng-002",
              "skill_label": "System Architecture",
              "not_assessed": true,
              "level": null,
              "confidence": null,
              "evidence": [],
              "competency_summary": "Skill was not probed during this session."
            }
          ],
          "discovered_skills": [
            {
              "skill_label": "Micro-frontend Architecture",
              "not_assessed": false,
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
        id:            map.skill_id || "skill-#{map.id}",
        label:         map.skill_label,
        state:         map.state,
        probe_count:   map.probe_count,
        is_discovered: map.is_discovered
      }
    end

    def save_skills(portfolio, response)
      data = response.is_a?(Hash) ? response : JSON.parse(response)

      # Destroy existing skills (idempotent regeneration)
      portfolio.portfolio_skills.destroy_all

      configured_skills = @session.assessment.assessment_skills.to_a
      configured_by_id = configured_skills.index_by(&:skill_id).compact
      configured_by_label = configured_skills.index_by { |s| s.skill_label.downcase }

      (data['configured_skills'] || []).each do |skill_data|
        attrs = extract_skill_attrs(skill_data)

        original_skill = (skill_data['skill_id'].present? && configured_by_id[skill_data['skill_id']]) ||
                         configured_by_label[skill_data['skill_label']&.downcase]

        # Use canonical skill_id from assessment_skills if matched, otherwise sanitize to max 50 chars
        canonical_skill_id = original_skill ? original_skill.skill_id : skill_data['skill_id']
        canonical_skill_id = canonical_skill_id&.to_s&.slice(0, 50)

        portfolio.portfolio_skills.create!(
          skill_id:      canonical_skill_id,
          skill_label:   original_skill&.skill_label || skill_data['skill_label'],
          is_discovered: false,
          **attrs
        )
      end

      (data['discovered_skills'] || []).each do |skill_data|
        attrs = extract_skill_attrs(skill_data)
        portfolio.portfolio_skills.create!(
          skill_id:      nil,
          skill_label:   skill_data['skill_label'],
          is_discovered: true,
          **attrs
        )
      end
    end

    def save_unassessed_skills_for_empty_transcript(portfolio)
      portfolio.portfolio_skills.destroy_all
      @session.assessment.assessment_skills.order(:display_order).each do |skill|
        portfolio.portfolio_skills.create!(
          skill_id:           skill.skill_id&.slice(0, 50),
          skill_label:        skill.skill_label,
          is_discovered:      false,
          not_assessed:       true,
          ai_level:           nil,
          ai_confidence:      nil,
          evidence:           [],
          competency_summary: 'Sesi interview tidak memiliki rekaman percakapan (0 turns). Skill tidak dapat dinilai.'
        )
      end
    end

    def extract_skill_attrs(skill_data)
      not_assessed = [true, 'true'].include?(skill_data['not_assessed']) || skill_data['level'].nil?
      ai_level     = not_assessed ? nil : skill_data['level'].to_i.clamp(1, 5)

      {
        not_assessed:       not_assessed,
        ai_level:           ai_level,
        ai_confidence:      not_assessed ? nil : skill_data['confidence'],
        evidence:           not_assessed ? [] : Array(skill_data['evidence']).first(3),
        competency_summary: skill_data['competency_summary'].to_s
      }
    end
  end
end
