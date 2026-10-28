
# frozen_string_literal: true

module Portfolios
  # N10: Generates a structured skill portfolio from the full transcript
  # and final coverage map using Gemini Pro.
  # Runs post-session as a background job.
  class Generator
    def initialize(session:, gemini_client: nil)
      @session = session
      @gemini_client = gemini_client || Gemini::HttpClient.new(
        model: ENV.fetch('GEMINI_PRO_MODEL', 'gemini-2.0-pro-001'),
        timeout: 180
      )
    end

    def call
      portfolio = @session.portfolio || @session.create_portfolio!(
        candidate_id: @session.candidate_id,
        generation_status: 'pending'
      )

      portfolio.update!(generation_status: 'generating')

      prompt = build_prompt
      response = @gemini_client.generate_content(prompt, temperature: 0.2)

      save_skills(portfolio, response)
      portfolio.update!(generation_status: 'complete', generated_at: Time.current)

      Rails.logger.info("[N10] Portfolio generated for session #{@session.id}")
      portfolio
    rescue StandardError => e
      portfolio&.update!(
        generation_status: 'failed',
        generation_error: 'Portfolio generation failed. Please retry.'
      )
      Rails.logger.error(
        "[N10] Portfolio generation failed for session #{@session.id}: #{e.class}"
      )
      raise
    end

    private

    def build_prompt
      assessment = @session.assessment
      configured_skills = assessment.assessment_skills.order(:display_order)
      coverage_maps = @session.coverage_maps.order(:id)
      turns = @session.transcript_turns.ordered

      skills_text = configured_skills.map do |skill|
        skill_definition_block(skill)
      end.join("\n\n")

      coverage_json = {
        skills: coverage_maps.reject(&:is_discovered).map { |map| coverage_json(map) },
        discovered: coverage_maps.select(&:is_discovered).map { |map| coverage_json(map) }
      }.to_json

      transcript_text = turns.map do |turn|
        "[#{turn.speaker.upcase}]: #{turn.text}"
      end.join("\n")

      <<~PROMPT
        You are evaluating a completed skills assessment interview to produce a structured skill portfolio.

        ROLE BEING ASSESSED: #{assessment.name}

        SKILL DEFINITIONS AND BEHAVIORAL ANCHORS:
        #{skills_text}

        IMPORTANT SKILL ID RULES:
        - For configured skills, use the exact skill label shown in SKILL DEFINITIONS.
        - Copy the exact configured skill ID shown in parentheses.
        - If the ID is shown as "custom", return "skill_id": null.
        - Never invent or modify a configured skill ID.
        - Do not add configured skills that are not in SKILL DEFINITIONS.
        - Discovered skills must not duplicate configured skills.

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

        TASK

        For each skill in the coverage map (both configured and discovered):

        1. FIND THE EVIDENCE
           Read the transcript turns where this skill was discussed.
           Identify 2-3 revealing quotes from the CANDIDATE, not the AI.
           Quotes should show how the candidate thinks, not just what they know.

        2. ASSIGN A LEVEL
           Compare the candidate's actual behavior to the L1-L5 anchors.
           Assign the highest level supported by consistent evidence.
           If evidence is mixed, choose the level best supported overall.

        3. WRITE THE COMPETENCY SUMMARY
           Write 2-3 sentences focused on patterns, not individual answers.
           Describe what the candidate reliably does, their current ceiling, and what is missing.

        4. ASSIGN CONFIDENCE
           high — probe_count >= 3 AND state = covered
           medium — probe_count = 2 OR state = partial
           low — probe_count <= 1 OR state = initiated

        OUTPUT JSON ONLY, with no additional prose:
        {
          "configured_skills": [
            {
              "skill_id": null,
              "skill_label": "Exact configured skill label from SKILL DEFINITIONS",
              "level": 3,
              "confidence": "medium",
              "evidence": ["exact candidate quote"],
              "competency_summary": "A 2-3 sentence summary based on the evidence."
            }
          ],
          "discovered_skills": [
            {
              "skill_label": "A genuinely discovered skill",
              "level": 2,
              "confidence": "low",
              "evidence": ["exact candidate quote"],
              "competency_summary": "A 2-3 sentence summary based on the evidence."
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
        id: map.skill_id || map.skill_label.downcase.gsub(/\s+/, '-'),
        label: map.skill_label,
        state: map.state,
        probe_count: map.probe_count,
        is_discovered: map.is_discovered
      }
    end

    def save_skills(portfolio, response)
      data = validated_response(response)
      desired_rows = data.fetch("configured_skills") + data.fetch("discovered_skills")
      existing = portfolio.portfolio_skills.includes(:assessor_override).to_a

      PortfolioSkill.transaction do
        retained_ids = []

        desired_rows.each do |attributes|
          current = existing.find { |skill| same_skill?(skill, attributes) }

          if current
            current.update!(attributes)
            current.assessor_override&.update!(ai_level: current.ai_level)
            retained_ids << current.id
          else
            created = portfolio.portfolio_skills.create!(attributes)
            retained_ids << created.id
          end
        end

        existing.each do |skill|
          next if retained_ids.include?(skill.id)
          next if skill.assessor_override.present?

          skill.destroy!
        end
      end
    end

    def validated_response(response)
      data = response.is_a?(Hash) ? response : JSON.parse(response)

      unless data.is_a?(Hash) &&
             data["configured_skills"].is_a?(Array) &&
             data["discovered_skills"].is_a?(Array)
        raise JSON::ParserError,
              "Expected configured_skills and discovered_skills arrays"
      end

      configured_definitions =
        @session.assessment.assessment_skills.order(:display_order).to_a
      candidate_turns =
        @session.transcript_turns.where(speaker: "candidate").pluck(:text)

      configured = validate_skill_rows(
        data["configured_skills"],
        discovered: false,
        configured_definitions: configured_definitions,
        candidate_turns: candidate_turns
      )

      discovered = validate_skill_rows(
        data["discovered_skills"],
        discovered: true,
        configured_definitions: configured_definitions,
        candidate_turns: candidate_turns
      )

      keys = (configured + discovered).map do |row|
        [row[:is_discovered], row[:skill_id], row[:skill_label].downcase]
      end

      unless keys.uniq.length == keys.length
        raise JSON::ParserError, "Duplicate skill rows returned by the model"
      end

      missing = configured_definitions.reject do |definition|
        configured.any? do |row|
          if definition.skill_id.present?
            row[:skill_id] == definition.skill_id
          else
            row[:skill_label].casecmp?(definition.skill_label)
          end
        end
      end

      if missing.any?
        raise JSON::ParserError, "Model response omitted configured assessment skills"
      end

      {
        "configured_skills" => configured,
        "discovered_skills" => discovered
      }
    end

    def validate_skill_rows(rows, discovered:, configured_definitions:, candidate_turns:)
      rows.map do |raw|
        unless raw.is_a?(Hash)
          raise JSON::ParserError, "Skill row must be an object"
        end

        label = raw["skill_label"]
        level = raw["level"]
        confidence = raw["confidence"]
        evidence = raw["evidence"]
        summary = raw["competency_summary"]

        unless label.is_a?(String) && label.strip.present?
          raise JSON::ParserError, "Skill label missing"
        end

        unless level.is_a?(Integer) && level.between?(1, 5)
          raise JSON::ParserError, "Skill level must be an integer from 1 to 5"
        end

        unless PortfolioSkill::CONFIDENCE_LEVELS.include?(confidence)
          raise JSON::ParserError, "Invalid skill confidence"
        end

        unless evidence.is_a?(Array) && evidence.all? { |quote| quote.is_a?(String) }
          raise JSON::ParserError, "Evidence must be an array of strings"
        end

        unless summary.is_a?(String) && summary.strip.present?
          raise JSON::ParserError, "Competency summary missing"
        end

        skill_id = nil

        if discovered
          if configured_definitions.any? do |definition|
               definition.skill_label.casecmp?(label.strip)
             end
            raise JSON::ParserError, "Discovered skill duplicates a configured skill"
          end
        else
          raw_id = raw["skill_id"]

          if raw_id.present? && !raw_id.is_a?(String)
            raise JSON::ParserError, "Skill ID must be a string or null"
          end

          # Prefer exact ID matching. If the configured definition has no ID,
          # fall back to its exact case-insensitive label.
          definition = if raw_id.present?
                         configured_definitions.find do |item|
                           item.skill_id == raw_id
                         end || configured_definitions.find do |item|
                           item.skill_id.blank? &&
                             item.skill_label.casecmp?(label.strip)
                         end
                       else
                         configured_definitions.find do |item|
                           item.skill_id.blank? &&
                             item.skill_label.casecmp?(label.strip)
                         end
                       end

          unless definition
            raise JSON::ParserError, "Model returned an unknown configured skill"
          end

          skill_id = definition.skill_id
          label = definition.skill_label
        end

        supported_evidence = evidence.map(&:strip).reject(&:blank?).uniq.select do |quote|
          normalized_quote = normalize_quote(quote)
          normalized_quote.present? && candidate_turns.any? do |turn|
            normalize_quote(turn).include?(normalized_quote)
          end
        end.first(3)

        {
          skill_id: skill_id,
          skill_label: label.strip,
          is_discovered: discovered,
          ai_level: level,
          ai_confidence: confidence,
          evidence: supported_evidence,
          competency_summary: summary.strip
        }
      end
    end

    def normalize_quote(value)
      value.to_s.downcase.gsub(/\s+/, " ").strip
    end

    def same_skill?(existing, attributes)
      return false unless existing.is_discovered == attributes[:is_discovered]

      if attributes[:skill_id].present?
        existing.skill_id == attributes[:skill_id]
      else
        existing.skill_label.casecmp?(attributes[:skill_label])
      end
    end
  end
end
