# frozen_string_literal: true

module Portfolios
  # N10: Generates a structured skill portfolio from the full transcript
  # and final coverage map using Gemini Pro.
  # Runs post-session as a background job.
  class Generator
    class ValidationError < StandardError; end

    VALID_CONFIDENCES = %w[high medium low].freeze

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

      # Determine if a valid published evaluation exists (prior to this generation run)
      had_prior_valid = portfolio.published_result?

      portfolio.update!(generation_status: 'generating') unless portfolio.generating?

      prompt = build_prompt
      raw_response = @gemini_client.generate_content(prompt, temperature: 0.2)
      validated_payload = validate_and_normalize_payload(raw_response)

      # Acquire pessimistic lock and atomically persist skills
      portfolio.with_lock do
        portfolio.portfolio_skills.destroy_all

        validated_payload[:configured_skills].each do |skill_data|
          portfolio.portfolio_skills.create!(
            skill_id:           skill_data[:skill_id],
            skill_label:        skill_data[:skill_label],
            is_discovered:      false,
            ai_level:           skill_data[:ai_level],
            ai_confidence:      skill_data[:ai_confidence],
            evidence:           skill_data[:evidence],
            competency_summary: skill_data[:competency_summary]
          )
        end

        validated_payload[:discovered_skills].each do |skill_data|
          portfolio.portfolio_skills.create!(
            skill_id:           nil,
            skill_label:        skill_data[:skill_label],
            is_discovered:      true,
            ai_level:           skill_data[:ai_level],
            ai_confidence:      skill_data[:ai_confidence],
            evidence:           skill_data[:evidence],
            competency_summary: skill_data[:competency_summary]
          )
        end

        portfolio.update!(
          generation_status: 'complete',
          generated_at:      Time.current,
          generation_error:  nil
        )
      end

      Rails.logger.info("[N10] Portfolio successfully generated for session #{@session.id}")
      portfolio
    rescue StandardError => e
      if had_prior_valid
        portfolio&.update!(
          generation_status: 'complete',
          generation_error:  'Regeneration failed. Preserved previous results.'
        )
      else
        portfolio&.update!(
          generation_status: 'failed',
          generation_error:  'Evaluation generation failed.'
        )
      end

      Rails.logger.error("[N10] Portfolio generation failed for session #{@session.id}: #{e.class}")
      raise
    end

    private

    def validate_and_normalize_payload(raw_response)
      data = parse_json_safely(raw_response)
      raise ValidationError, 'Response root must be a JSON object' unless data.is_a?(Hash)

      configured_input = data['configured_skills']
      raise ValidationError, 'configured_skills must be an array' unless configured_input.is_a?(Array)

      discovered_input = data['discovered_skills'] || []
      raise ValidationError, 'discovered_skills must be an array' unless discovered_input.is_a?(Array)

      expected_skills = @session.assessment.assessment_skills.order(:display_order)
      expected_map = expected_skills.index_by { |s| s.skill_id.presence || "custom-#{s.id}" }
      expected_keys = expected_map.keys

      # 1. Validate configured skills
      seen_keys = Set.new
      normalized_configured = configured_input.map do |item|
        raise ValidationError, 'Configured skill item must be an object' unless item.is_a?(Hash)

        key = item['skill_id'].to_s
        raise ValidationError, "Duplicate skill_id: #{key}" if seen_keys.include?(key)
        raise ValidationError, "Unknown skill_id: #{key}" unless expected_map.key?(key)

        seen_keys.add(key)
        skill_config = expected_map[key]

        attrs = validate_skill_attributes(item)
        attrs.merge(
          skill_id:    skill_config.skill_id, # real skill_id or nil for custom
          skill_label: skill_config.skill_label # canonical label from DB
        )
      end

      missing_keys = expected_keys - seen_keys.to_a
      unless missing_keys.empty?
        raise ValidationError, "Missing configured skills: #{missing_keys.join(', ')}"
      end

      # 2. Validate discovered skills
      seen_discovered_labels = Set.new
      normalized_discovered = discovered_input.map do |item|
        raise ValidationError, 'Discovered skill item must be an object' unless item.is_a?(Hash)

        label = item['skill_label'].to_s.strip
        raise ValidationError, 'Discovered skill label cannot be blank' if label.blank?
        raise ValidationError, "Duplicate discovered skill label: #{label}" if seen_discovered_labels.include?(label.downcase)

        seen_discovered_labels.add(label.downcase)
        attrs = validate_skill_attributes(item)
        attrs.merge(
          skill_id:    nil,
          skill_label: label
        )
      end

      {
        configured_skills: normalized_configured,
        discovered_skills: normalized_discovered
      }
    end

    def validate_skill_attributes(item)
      level = item['level']
      unless level.is_a?(Integer) && level.between?(1, 5)
        raise ValidationError, "Level must be an integer between 1 and 5 (got: #{level.inspect})"
      end

      confidence = item['confidence'].to_s.downcase
      unless VALID_CONFIDENCES.include?(confidence)
        raise ValidationError, "Confidence must be one of #{VALID_CONFIDENCES.join(', ')} (got: #{confidence.inspect})"
      end

      competency_summary = item['competency_summary'].to_s.strip
      if competency_summary.blank?
        raise ValidationError, 'competency_summary cannot be blank'
      end

      raw_evidence = item['evidence']
      unless raw_evidence.is_a?(Array)
        raise ValidationError, 'evidence must be an array of strings'
      end

      evidence_array = []
      raw_evidence.each do |quote|
        unless quote.is_a?(String)
          raise ValidationError, 'evidence must be an array of strings'
        end

        q = quote.strip
        if q.empty?
          raise ValidationError, 'evidence quotes cannot be empty or blank'
        end

        evidence_array << q
      end

      {
        ai_level:           level,
        ai_confidence:      confidence,
        evidence:           evidence_array.first(3),
        competency_summary: competency_summary
      }
    end

    def parse_json_safely(raw_response)
      return raw_response if raw_response.is_a?(Hash)

      text = raw_response.to_s.strip
      # Clean potential markdown code fences from LLM
      cleaned = text.sub(/\A```(?:json)?\s*/i, '').sub(/\s*```\z/i, '')
      JSON.parse(cleaned)
    rescue JSON::ParserError => e
      raise ValidationError, "Malformed JSON response from AI provider: #{e.message}"
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
           Assign an integer level between 1 and 5 where you see CONSISTENT evidence, not just one strong moment.
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
              "skill_id": "SK-ENG-001",
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
      eval_key = skill.skill_id.presence || "custom-#{skill.id}"
      lines = ["━━━━━━━━━━━━━━━"]
      lines << "SKILL: #{skill.skill_label} (ID: #{eval_key})"
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
  end
end
