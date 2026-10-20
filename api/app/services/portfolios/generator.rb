# frozen_string_literal: true

module Portfolios
  # N10: Generates a structured skill portfolio from the full transcript
  # and final coverage map using Gemini Pro.
  # Runs post-session as a background job.
  class Generator
    ASSESSABLE_STATES = %w[partial covered].freeze
    MIN_ASSESSABLE_PROBES = 2

    def initialize(session:, gemini_client: nil)
      @session = session
      @gemini_client = gemini_client || Gemini::HttpClient.new(
        model:   ENV.fetch('GEMINI_PRO_MODEL', 'gemini-2.0-pro-001'),
        timeout: 180 # up to 3 minutes for large transcripts
      )
    end

    # Returns the Portfolio record with skills populated.
    def call
      portfolio = @session.portfolio || @session.create_portfolio!(
        candidate_id:      @session.candidate_id,
        generation_status: 'pending'
      )

      portfolio.update!(generation_status: 'generating', generation_error: nil)

      if assessable_configured_maps.empty? && assessable_discovered_maps.empty?
        ActiveRecord::Base.transaction do
          portfolio.portfolio_skills.destroy_all
          portfolio.update!(generation_status: 'complete', generated_at: Time.current, generation_error: nil)
        end
        Rails.logger.info("[N10] Portfolio completed with 0 assessable skills for session #{@session.id}")
        return portfolio
      end

      prompt   = build_prompt
      response = @gemini_client.generate_content(prompt, temperature: 0.2)

      ActiveRecord::Base.transaction do
        save_skills(portfolio, response)
        portfolio.update!(generation_status: 'complete', generated_at: Time.current, generation_error: nil)
      end

      Rails.logger.info("[N10] Portfolio generated for session #{@session.id}")
      portfolio
    rescue StandardError => e
      portfolio&.update!(generation_status: 'failed', generation_error: "#{e.class}: #{e.message}".truncate(500))
      Rails.logger.error("[N10] Portfolio generation failed for session #{@session.id}: #{e.class} #{e.message}")
      raise
    end

    private

    def assessable_map?(map)
      map.present? && ASSESSABLE_STATES.include?(map.state) && map.probe_count.to_i >= MIN_ASSESSABLE_PROBES
    end

    def assessable_configured_maps
      @assessable_configured_maps ||= @session.coverage_maps
                                              .order(:id)
                                              .reject(&:is_discovered)
                                              .select { |m| assessable_map?(m) }
    end

    def assessable_discovered_maps
      @assessable_discovered_maps ||= @session.coverage_maps
                                              .order(:id)
                                              .select(&:is_discovered)
                                              .select { |m| m.probe_count.to_i.positive? && m.state != 'not_yet' }
    end

    def build_prompt
      assessment = @session.assessment
      assessable_ids = assessable_configured_maps.filter_map(&:skill_id)
      assessable_labels = assessable_configured_maps.map { |m| m.skill_label.downcase }

      configured_skills = assessment.assessment_skills.order(:display_order).select do |s|
        (s.skill_id.present? && assessable_ids.include?(s.skill_id)) ||
          assessable_labels.include?(s.skill_label.downcase)
      end

      turns = @session.transcript_turns.ordered

      skills_text = configured_skills.map { |s| skill_definition_block(s) }.join("\n\n")

      coverage_json = {
        skills:     assessable_configured_maps.map { |m| coverage_json(m) },
        discovered: assessable_discovered_maps.map { |m| coverage_json(m) }
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

        FINAL COVERAGE MAP (ONLY ASSESSABLE SKILLS WITH SUFFICIENT PROBING):
        #{coverage_json}

        FULL INTERVIEW TRANSCRIPT:
        #{transcript_text}

        ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        TASK
        ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

        For EACH skill in the coverage map above (both configured and discovered):

        1. FIND THE EVIDENCE
           Read all transcript turns where this skill was discussed.
           Identify the 2-3 most revealing quotes from the CANDIDATE (not the AI).
           A quote is revealing if it shows HOW they think, not just WHAT they know.

        2. ASSIGN A LEVEL
           Compare the candidate's actual behavior to the L1-L5 anchors.
           Assign the highest level where you see CONSISTENT evidence, not just one strong moment.
           If evidence is mixed (mostly L2 with one L3 moment), assign L2.
           If transcript evidence is insufficient to justify any level, set "level": null.

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

    def save_skills(portfolio, response)
      data = response.is_a?(Hash) ? response : JSON.parse(response)

      # Destroy existing skills inside the caller's transaction (idempotent regeneration)
      portfolio.portfolio_skills.destroy_all

      (data['configured_skills'] || []).each do |skill_data|
        map = find_assessable_configured_map(skill_data['skill_id'], skill_data['skill_label'])
        next unless map

        parsed_level = parse_valid_level(skill_data['level'])
        evidence     = sanitize_evidence(skill_data['evidence'])
        summary      = skill_data['competency_summary'].to_s.strip
        next if parsed_level.nil? || evidence.empty? || summary.blank?

        portfolio.portfolio_skills.create!(
          skill_id:           map.skill_id || skill_data['skill_id'],
          skill_label:        map.skill_label.presence || skill_data['skill_label'],
          is_discovered:      false,
          ai_level:           parsed_level,
          ai_confidence:      normalize_confidence(skill_data['confidence'], map),
          evidence:           evidence,
          competency_summary: summary
        )
      end

      (data['discovered_skills'] || []).each do |skill_data|
        parsed_level = parse_valid_level(skill_data['level'])
        evidence     = sanitize_evidence(skill_data['evidence'])
        summary      = skill_data['competency_summary'].to_s.strip
        label        = skill_data['skill_label'].to_s.strip
        next if label.blank? || parsed_level.nil? || evidence.empty? || summary.blank?

        portfolio.portfolio_skills.create!(
          skill_id:           nil,
          skill_label:        label,
          is_discovered:      true,
          ai_level:           parsed_level,
          ai_confidence:      normalize_discovered_confidence(skill_data['confidence']),
          evidence:           evidence,
          competency_summary: summary
        )
      end
    end

    def find_assessable_configured_map(skill_id, skill_label)
      if skill_id.present?
        matched = assessable_configured_maps.find { |m| m.skill_id.to_s.casecmp?(skill_id.to_s) }
        return matched if matched
      end

      return nil if skill_label.blank?

      assessable_configured_maps.find { |m| m.skill_label.to_s.casecmp?(skill_label.to_s) }
    end

    def parse_valid_level(raw_level)
      return nil if raw_level.nil? || raw_level.to_s.strip.blank?

      int_val = Integer(raw_level, exception: false)
      return nil unless int_val && int_val.between?(1, 5)

      int_val
    end

    def sanitize_evidence(raw_evidence)
      Array(raw_evidence).map { |q| q.to_s.strip }.reject(&:blank?).first(3)
    end

    def normalize_confidence(raw_confidence, map)
      conf = raw_confidence.to_s.downcase
      conf = 'medium' unless PortfolioSkill::CONFIDENCE_LEVELS.include?(conf)

      if map.state == 'partial' || map.probe_count.to_i < 3
        conf = 'medium' if conf == 'high'
      end

      conf
    end

    def normalize_discovered_confidence(raw_confidence)
      conf = raw_confidence.to_s.downcase
      PortfolioSkill::CONFIDENCE_LEVELS.include?(conf) ? conf : 'low'
    end
  end
end
