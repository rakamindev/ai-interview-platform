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

      candidate_turns = @session.transcript_turns.where(speaker: 'candidate')

      if candidate_turns.empty?
        # Fast-path for 0-dialogue sessions: mark all configured skills as unassessed
        save_unassessed_skills(portfolio)
        portfolio.update!(generation_status: 'complete', generated_at: Time.current, generation_error: nil)
        Rails.logger.info("[N10] Generated unassessed portfolio for session #{@session.id} (no candidate turns)")
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

        1. CHECK COVERAGE & EVIDENCE
           If the skill was NEVER discussed or probe_count is 0 or state is "not_yet", do NOT invent a rating. Mark level as null.
           Otherwise, read transcript turns where this skill was discussed and identify the 2-3 most revealing quotes from the CANDIDATE (not the AI).

        2. ASSIGN A LEVEL (1 to 5, or null if unassessed)
           Compare candidate actual behavior to L1-L5 anchors.
           Assign the highest level with consistent evidence. If unassessed, assign null.

        3. WRITE COMPETENCY SUMMARY
           2-3 sentences focusing on behavioral patterns and evidence. If unassessed, write "Skill was not assessed in this session."

        4. ASSIGN CONFIDENCE
           high   — probe_count >= 3 AND state = covered
           medium — probe_count = 2 OR state = partial
           low    — probe_count <= 1 OR state = initiated OR unassessed

        OUTPUT (JSON only, no markdown, no prose):
        {
          "configured_skills": [
            {
              "skill_id": "sk-eng-001",
              "skill_label": "React / Frontend Development",
              "level": 3,
              "confidence": "high",
              "evidence": ["quote 1", "quote 2"],
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
      lines << "EXCLUDE: #{skill.scope_exclude}" if skill.scope_exclude.present?
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
        id:            map.skill_id || map.skill_label.downcase.gsub(/\s+/, '-'),
        label:         map.skill_label,
        state:         map.state,
        probe_count:   map.probe_count,
        is_discovered: map.is_discovered
      }
    end

    def save_skills(portfolio, response)
      data = response.is_a?(Hash) ? response : JSON.parse(response)

      # 1. Monozukuri Data Protection: Cache existing assessor overrides before updating
      # to prevent losing human judgments on regeneration.
      cached_overrides = portfolio.portfolio_skills.includes(:assessor_override).each_with_object({}) do |ps, h|
        next unless ps.assessor_override

        key = ps.skill_id.presence || ps.skill_label.downcase.strip
        h[key] = {
          override_level: ps.assessor_override.override_level,
          assessor_notes: ps.assessor_override.assessor_notes,
          overridden_by:  ps.assessor_override.overridden_by,
          overridden_at:  ps.assessor_override.overridden_at
        }
      end

      # Map coverage states for quick lookup
      coverage_by_label = @session.coverage_maps.index_by { |m| m.skill_label.downcase.strip }

      ActiveRecord::Base.transaction do
        portfolio.portfolio_skills.destroy_all

        configured_records = (data['configured_skills'] || [])
        handled_labels     = Set.new

        configured_records.each do |skill_data|
          label = skill_data['skill_label'].to_s.strip
          next if label.blank?

          handled_labels.add(label.downcase)
          cov_map = coverage_by_label[label.downcase]

          is_unassessed = cov_map && (cov_map.state == 'not_yet' || cov_map.probe_count.zero?)
          raw_level     = skill_data['level']

          level = if is_unassessed || raw_level.nil? || raw_level.to_i.zero?
                    nil
                  else
                    raw_level.to_i.clamp(1, 5)
                  end

          ps = portfolio.portfolio_skills.create!(
            skill_id:           skill_data['skill_id'],
            skill_label:        label,
            is_discovered:      false,
            is_assessed:        level.present?,
            ai_level:           level,
            ai_confidence:      level.nil? ? 'low' : (skill_data['confidence'].presence || 'medium'),
            evidence:           level.nil? ? [] : Array(skill_data['evidence']).first(3),
            competency_summary: skill_data['competency_summary'].presence || (level.nil? ? 'Not assessed in this interview session.' : 'Demonstrated competency.')
          )

          reapply_override(ps, cached_overrides)
        end

        # Ensure all assessment configured skills exist, even if LLM omitted them
        @session.assessment.assessment_skills.order(:display_order).each do |askill|
          next if handled_labels.include?(askill.skill_label.downcase.strip)

          ps = portfolio.portfolio_skills.create!(
            skill_id:           askill.skill_id,
            skill_label:        askill.skill_label,
            is_discovered:      false,
            is_assessed:        false,
            ai_level:           nil,
            ai_confidence:      'low',
            evidence:           [],
            competency_summary: 'Not assessed in this interview session.'
          )

          reapply_override(ps, cached_overrides)
        end

        (data['discovered_skills'] || []).each do |skill_data|
          label = skill_data['skill_label'].to_s.strip
          next if label.blank?

          raw_level = skill_data['level']
          level     = raw_level.present? && raw_level.to_i > 0 ? raw_level.to_i.clamp(1, 5) : 2

          ps = portfolio.portfolio_skills.create!(
            skill_id:           nil,
            skill_label:        label,
            is_discovered:      true,
            is_assessed:        true,
            ai_level:           level,
            ai_confidence:      skill_data['confidence'].presence || 'low',
            evidence:           Array(skill_data['evidence']).first(3),
            competency_summary: skill_data['competency_summary'].presence || 'Discovered off-agenda skill.'
          )

          reapply_override(ps, cached_overrides)
        end
      end
    end

    def save_unassessed_skills(portfolio)
      ActiveRecord::Base.transaction do
        portfolio.portfolio_skills.destroy_all

        @session.assessment.assessment_skills.order(:display_order).each do |askill|
          portfolio.portfolio_skills.create!(
            skill_id:           askill.skill_id,
            skill_label:        askill.skill_label,
            is_discovered:      false,
            is_assessed:        false,
            ai_level:           nil,
            ai_confidence:      'low',
            evidence:           [],
            competency_summary: 'Not assessed — interview concluded before dialogue took place.'
          )
        end
      end
    end

    def reapply_override(portfolio_skill, cached_overrides)
      key = portfolio_skill.skill_id.presence || portfolio_skill.skill_label.downcase.strip
      override_data = cached_overrides[key]
      return unless override_data

      portfolio_skill.create_assessor_override!(
        ai_level:       portfolio_skill.ai_level || 1,
        override_level: override_data[:override_level],
        assessor_notes: override_data[:assessor_notes],
        overridden_by:  override_data[:overridden_by],
        overridden_at:  override_data[:overridden_at]
      )
    end
  end
end
