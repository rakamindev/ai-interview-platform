# frozen_string_literal: true

module Portfolios
  # N10: Generates a structured skill portfolio from the full transcript
  # and final coverage map using Gemini Pro.
  # Runs post-session as a background job.
  class Generator
    NOT_ASSESSED_SUMMARY = PortfolioSkill::NOT_ASSESSED_SUMMARY

    def initialize(session:, gemini_client: nil)
      @session = session
      @gemini_client = gemini_client || Gemini::HttpClient.new(
        model:   ENV.fetch('GEMINI_PRO_MODEL', 'gemini-2.0-pro-001'),
        timeout: 180
      )
    end

    def call
      portfolio = @session.portfolio || @session.create_portfolio!(
        candidate_id:      @session.candidate_id,
        generation_status: 'pending'
      )

      portfolio.update!(generation_status: 'generating')

      ActiveRecord::Base.transaction do
        classification = classify_coverage_maps
        portfolio.portfolio_skills.destroy_all

        save_not_assessed_skills(portfolio, classification[:not_assessed])

        if classification[:assessed].any?
          prompt   = build_prompt(classification[:assessed])
          response = @gemini_client.generate_content(prompt, temperature: 0.2)
          save_assessed_skills(portfolio, classification[:assessed], response)
        end

        portfolio.update!(generation_status: 'complete', generated_at: Time.current)
      end

      Rails.logger.info("[N10] Portfolio generated for session #{@session.id}")
      portfolio
    rescue => e
      portfolio&.update!(generation_status: 'failed', generation_error: e.message)
      Rails.logger.error("[N10] Portfolio generation failed for session #{@session.id}: #{e.class} #{e.message}")
      raise
    end

    private

    def classify_coverage_maps
      maps = @session.coverage_maps.order(:id).to_a
      assessed = maps.select { |map| assessed_coverage?(map) }
      {
        assessed:     assessed,
        not_assessed: maps - assessed
      }
    end

    def assessed_coverage?(map)
      return true if map.state.in?(%w[partial covered])
      return true if map.state == 'initiated' && map.probe_count >= 2

      false
    end

    def save_not_assessed_skills(portfolio, maps)
      maps.each do |map|
        portfolio.portfolio_skills.create!(
          skill_id:           map.skill_id,
          skill_label:        map.skill_label,
          is_discovered:      map.is_discovered,
          assessment_status:  'not_assessed',
          ai_level:           nil,
          ai_confidence:      nil,
          evidence:           [],
          competency_summary: NOT_ASSESSED_SUMMARY,
          coverage_state:     map.state,
          probe_count:        map.probe_count
        )
      end
    end

    def build_prompt(assessed_maps)
      assessment = @session.assessment
      turns      = @session.transcript_turns.ordered

      assessed_configured = assessed_maps.reject(&:is_discovered)
      assessed_discovered = assessed_maps.select(&:is_discovered)
      assessed_labels = assessed_maps.map(&:skill_label)

      skills_text = assessment.assessment_skills
                              .select { |s| assessed_labels.include?(s.skill_label) }
                              .sort_by(&:display_order)
                              .map { |s| skill_definition_block(s) }
                              .join("\n\n")

      coverage_json = {
        skills:     assessed_configured.map { |m| coverage_json(m) },
        discovered: assessed_discovered.map { |m| coverage_json(m) }
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

        SKILLS WITH ENOUGH COVERAGE TO RATE (rate ONLY these):
        #{coverage_json}

        FULL INTERVIEW TRANSCRIPT:
        #{transcript_text}

        ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        TASK
        ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

        For EACH skill listed under SKILLS WITH ENOUGH COVERAGE TO RATE:

        1. FIND THE EVIDENCE
           Read transcript turns where this skill was discussed.
           Identify the 2-3 most revealing quotes from the CANDIDATE (not the AI).

        2. ASSIGN A LEVEL (required integer 1-5)
           Compare behavior to L1-L5 anchors. Assign the highest level with CONSISTENT evidence.

        3. WRITE THE COMPETENCY SUMMARY
           2-3 sentences on patterns, ceiling, and gaps.

        4. ASSIGN CONFIDENCE
           high — probe_count >= 3 AND state = covered
           medium — probe_count = 2 OR state = partial
           low — probe_count <= 1 OR state = initiated

        Do NOT include skills that were not listed above. Every listed skill must have level, confidence, and competency_summary.

        OUTPUT (JSON only, no prose):
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
      lines = ['━━━━━━━━━━━━━━━']
      lines << "SKILL: #{skill.skill_label} (#{skill.skill_id || 'custom'})"
      lines << "SCOPE: #{skill.scope_include}" if skill.scope_include.present?
      lines << ''
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

    def save_assessed_skills(portfolio, assessed_maps, response)
      data = response.is_a?(Hash) ? response : JSON.parse(response)

      configured_data = Array(data['configured_skills'])
      discovered_data = Array(data['discovered_skills'])

      assessed_maps.each do |map|
        skill_data = find_skill_data(map, configured_data, discovered_data)
        raise "Missing Gemini rating for assessed skill: #{map.skill_label}" if skill_data.nil?

        level = skill_data['level']
        raise "Missing level for assessed skill: #{map.skill_label}" if level.nil? || level.to_s.strip.empty?

        level_int = Integer(level)
        unless level_int.between?(1, 5)
          raise "Invalid level #{level} for skill: #{map.skill_label}"
        end

        confidence = skill_data['confidence']
        unless PortfolioSkill::CONFIDENCE_LEVELS.include?(confidence)
          raise "Invalid confidence for skill: #{map.skill_label}"
        end

        summary = skill_data['competency_summary']
        raise "Missing competency_summary for skill: #{map.skill_label}" if summary.blank?

        portfolio.portfolio_skills.create!(
          skill_id:           map.is_discovered ? nil : map.skill_id,
          skill_label:        map.skill_label,
          is_discovered:      map.is_discovered,
          assessment_status:  'assessed',
          ai_level:           level_int,
          ai_confidence:      confidence,
          evidence:           Array(skill_data['evidence']).first(3),
          competency_summary: summary,
          coverage_state:     map.state,
          probe_count:        map.probe_count
        )
      end
    end

    def find_skill_data(map, configured_data, discovered_data)
      if map.is_discovered
        discovered_data.find { |d| d['skill_label']&.casecmp?(map.skill_label) }
      else
        configured_data.find { |d| d['skill_id'] == map.skill_id && map.skill_id.present? } ||
          configured_data.find { |d| d['skill_label']&.casecmp?(map.skill_label) }
      end
    end
  end
end
