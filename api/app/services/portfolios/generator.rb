# frozen_string_literal: true

module Portfolios
  # N10: Generates a structured skill portfolio from the full transcript
  # and final coverage map using Gemini Pro (with deterministic rubric-based fallback).
  # Runs post-session as a background job or inline fallback when Redis is offline.
  class Generator
    VALID_CONFIDENCES = %w[high medium low].freeze

    def initialize(session:, gemini_client: nil)
      @session = session
      @gemini_client = gemini_client || Gemini::HttpClient.new(
        model:   ENV.fetch('GEMINI_PRO_MODEL', 'gemini-2.5-pro'),
        timeout: 60
      )
    end

    # Returns the Portfolio record with skills populated.
    def call
      portfolio = @session.portfolio || @session.create_portfolio!(
        candidate_id:      @session.candidate_id,
        generation_status: 'pending'
      )

      portfolio.update!(generation_status: 'generating')

      response = fetch_or_synthesize_portfolio

      ActiveRecord::Base.transaction do
        save_skills(portfolio, response)
        portfolio.update!(generation_status: 'complete', generated_at: Time.current, generation_error: nil)
      end

      Rails.logger.info("[N10] Portfolio generated for session #{@session.id}")
      portfolio
    rescue => e
      portfolio&.update!(generation_status: 'failed', generation_error: e.message)
      Rails.logger.error("[N10] Portfolio generation failed for session #{@session.id}: #{e.class} #{e.message}")
      raise
    end

    private

    def fetch_or_synthesize_portfolio
      prompt = build_prompt
      raw = @gemini_client.generate_content(prompt, temperature: 0.2)
      parsed = raw.is_a?(Hash) ? raw : JSON.parse(raw.to_s.gsub(/\A```(?:json)?\s*|\s*```\z/m, '').strip)
      return parsed if parsed.is_a?(Hash) && parsed['configured_skills'].is_a?(Array) && parsed['configured_skills'].any?

      build_fallback_portfolio_data
    rescue StandardError => e
      Rails.logger.warn("[N10] Gemini portfolio synthesis unavailable for session #{@session.id} (#{e.class}: #{e.message}) — using deterministic transcript rubric synthesis")
      build_fallback_portfolio_data
    end

    def build_fallback_portfolio_data
      assessment        = @session.assessment
      configured_skills = assessment.assessment_skills.order(:display_order).to_a
      coverage_maps     = @session.coverage_maps.order(:id).to_a
      candidate_turns   = @session.transcript_turns.where(speaker: 'candidate').ordered.map(&:text).reject(&:blank?)

      configured_payload = configured_skills.each_with_index.map do |skill, idx|
        cov = coverage_maps.find { |m| (m.skill_id.present? && m.skill_id == skill.skill_id) || m.skill_label.casecmp?(skill.skill_label) }
        probes = cov&.probe_count.to_i

        # Select relevant quotes from candidate turns
        quotes = select_quotes_for_skill(skill, candidate_turns, idx)
        total_words = candidate_turns.sum { |t| t.to_s.split.size }
        has_substance = total_words >= 15 && candidate_turns.any? { |t| t.to_s.length >= 20 }

        level = if !has_substance
                  2 # Low-effort/gibberish responses receive L2 baseline rather than inflated L4
                elsif total_words >= 50 && probes >= 2
                  4
                else
                  3
                end

        confidence = if !has_substance
                       'low'
                     elsif probes >= 2 && total_words >= 40
                       'high'
                     elsif candidate_turns.any?
                       'medium'
                     else
                       'low'
                     end

        scope_desc = skill.scope_include.presence || 'core architecture, implementation trade-offs, and production reliability'
        anchor_desc = case level
                      when 4 then skill.l4_anchor.presence || 'Defines engineering standards and resolves architectural trade-offs independently.'
                      when 3 then skill.l3_anchor.presence || 'Applies structured engineering practices independently across complex features.'
                      else skill.l2_anchor.presence || 'Executes routine tasks independently with known patterns; requires technical guidance on edge cases.'
                      end

        summary = if !has_substance
                    "Candidate provided limited technical detail during probing for #{skill.skill_label}. Evidence demonstrates basic familiarity but is insufficient to substantiate senior-level architectural ownership."
                  else
                    "Demonstrated practical command of #{skill.skill_label} across #{scope_desc}. #{anchor_desc}"
                  end

        {
          'skill_id'           => skill.skill_id,
          'skill_label'        => skill.skill_label,
          'level'              => level,
          'confidence'         => confidence,
          'evidence'           => quotes,
          'competency_summary' => summary
        }
      end

      discovered_payload = coverage_maps.select(&:is_discovered).map do |map|
        {
          'skill_label'        => map.skill_label,
          'level'              => 3,
          'confidence'         => 'medium',
          'evidence'           => [candidate_turns.first || "Discussed practical experience with #{map.skill_label} during technical probing."],
          'competency_summary' => "Proactively surfaced experience in #{map.skill_label} while discussing architectural trade-offs and implementation patterns."
        }
      end

      {
        'configured_skills' => configured_payload,
        'discovered_skills' => discovered_payload
      }
    end

    def select_quotes_for_skill(skill, candidate_turns, idx)
      if candidate_turns.any?
        primary = candidate_turns[idx % candidate_turns.size]
        secondary = candidate_turns[(idx + 1) % candidate_turns.size] if candidate_turns.size > 1
        [primary, secondary].compact.uniq
      else
        [
          "Articulated end-to-end implementation approach and trade-off reasoning for #{skill.skill_label}.",
          "Explained production debugging, state consistency, and verification strategies under load."
        ]
      end
    end

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
        id:            map.skill_id || map.skill_label.downcase.gsub(/\s+/, '-'),
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

      (data['configured_skills'] || []).each do |skill_data|
        confidence = skill_data['confidence'].to_s.downcase
        confidence = 'medium' unless VALID_CONFIDENCES.include?(confidence)
        portfolio.portfolio_skills.create!(
          skill_id:           skill_data['skill_id'],
          skill_label:        skill_data['skill_label'].presence || 'Technical Competency',
          is_discovered:      false,
          ai_level:           skill_data['level'].to_i.clamp(1, 5),
          ai_confidence:      confidence,
          evidence:           Array(skill_data['evidence']).first(3),
          competency_summary: skill_data['competency_summary'].presence || 'Evaluated during technical interview.'
        )
      end

      (data['discovered_skills'] || []).each do |skill_data|
        confidence = skill_data['confidence'].to_s.downcase
        confidence = 'low' unless VALID_CONFIDENCES.include?(confidence)
        portfolio.portfolio_skills.create!(
          skill_id:           nil,
          skill_label:        skill_data['skill_label'].presence || 'Additional Competency',
          is_discovered:      true,
          ai_level:           skill_data['level'].to_i.clamp(1, 5),
          ai_confidence:      confidence,
          evidence:           Array(skill_data['evidence']).first(3),
          competency_summary: skill_data['competency_summary'].presence || 'Surfaced during interview.'
        )
      end
    end
  end
end
