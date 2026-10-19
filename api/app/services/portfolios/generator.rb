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

      portfolio.update!(generation_status: 'generating')

      prompt   = build_prompt
      response = @gemini_client.generate_content(prompt, temperature: 0.2)

      save_skills(portfolio, response)
      portfolio.update!(generation_status: 'complete', generated_at: Time.current)

      Rails.logger.info("[N10] Portfolio generated for session #{@session.id}")
      portfolio
    rescue => e
      portfolio&.update!(generation_status: 'failed', generation_error: e.message)
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

    def save_skills(portfolio, response)
      data = response.is_a?(Hash) ? response : JSON.parse(response)

      # 1. Capture existing overrides before modifications keyed by skill_id or normalized skill_label
      existing_overrides = {}
      portfolio.portfolio_skills.includes(:assessor_override).each do |ps|
        if ps.assessor_override.present?
          key = ps.skill_id.presence || ps.skill_label.downcase.strip
          existing_overrides[key] = {
            override_level: ps.assessor_override.override_level,
            assessor_notes: ps.assessor_override.assessor_notes,
            overridden_by:  ps.assessor_override.overridden_by,
            overridden_at:  ps.assessor_override.overridden_at
          }
        end
      end

      existing_skills_by_id    = portfolio.portfolio_skills.where.not(skill_id: nil).index_by(&:skill_id)
      existing_skills_by_label = portfolio.portfolio_skills.index_by { |s| s.skill_label.downcase.strip }

      incoming_skills = []

      (data['configured_skills'] || []).each do |skill_data|
        incoming_skills << {
          skill_id:           skill_data['skill_id'],
          skill_label:        skill_data['skill_label'],
          is_discovered:      false,
          ai_level:           skill_data['level'].to_i.clamp(1, 5),
          ai_confidence:      skill_data['confidence'],
          evidence:           Array(skill_data['evidence']).first(3),
          competency_summary: skill_data['competency_summary']
        }
      end

      (data['discovered_skills'] || []).each do |skill_data|
        incoming_skills << {
          skill_id:           nil,
          skill_label:        skill_data['skill_label'],
          is_discovered:      true,
          ai_level:           skill_data['level'].to_i.clamp(1, 5),
          ai_confidence:      skill_data['confidence'],
          evidence:           Array(skill_data['evidence']).first(3),
          competency_summary: skill_data['competency_summary']
        }
      end

      saved_skill_ids = []

      ActiveRecord::Base.transaction do
        incoming_skills.each do |skill_attrs|
          # Match existing skill by ID or label
          existing = (skill_attrs[:skill_id].present? && existing_skills_by_id[skill_attrs[:skill_id]]) ||
                     existing_skills_by_label[skill_attrs[:skill_label].downcase.strip]

          portfolio_skill = if existing
                              existing.update!(skill_attrs)
                              existing
                            else
                              portfolio.portfolio_skills.create!(skill_attrs)
                            end

          saved_skill_ids << portfolio_skill.id

          # Reapply or preserve human override
          match_key = portfolio_skill.skill_id.presence || portfolio_skill.skill_label.downcase.strip
          if (ov_data = existing_overrides[match_key])
            override = portfolio_skill.assessor_override || portfolio_skill.build_assessor_override
            override.assign_attributes(
              ai_level:       portfolio_skill.ai_level,
              override_level: ov_data[:override_level],
              assessor_notes: ov_data[:assessor_notes],
              overridden_by:  ov_data[:overridden_by],
              overridden_at:  ov_data[:overridden_at] || Time.current
            )
            override.save!
          end
        end

        # Remove any stale skills not present in new AI response
        portfolio.portfolio_skills.where.not(id: saved_skill_ids).destroy_all
      end
    end
  end
end
