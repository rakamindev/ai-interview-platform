# frozen_string_literal: true

module Portfolios
  # N10: Generates a structured skill portfolio from the full transcript
  # and final coverage map using Gemini Pro.
  # Runs post-session as a background job.
  class Generator
    class EmptyAiOutputError < StandardError; end

    NO_ASSESSMENT_SKILLS_ERROR = 'Assessment has no skills to evaluate'.freeze
    NO_COVERAGE_ERROR = 'Session has no skill coverage to evaluate'.freeze

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

      if (input_error = generation_input_error)
        portfolio.update!(generation_status: 'failed', generation_error: input_error)
        Rails.logger.error("[N10] Portfolio generation skipped for session #{@session.id}: #{input_error}")
        return portfolio
      end

      portfolio.update!(generation_status: 'generating', generation_error: nil)

      prompt   = build_prompt
      response = @gemini_client.generate_content(prompt, temperature: 0.2)

      outcome = save_skills(portfolio, response)

      if outcome[:saved].positive? && outcome[:failed].zero?
        portfolio.update!(generation_status: 'complete', generated_at: Time.current, generation_error: nil)
        Rails.logger.info("[N10] Portfolio generated for session #{@session.id}")
      elsif outcome[:saved].positive?
        # Best-effort partial save: keep the valid skills, surface what was lost.
        portfolio.update!(
          generation_status: 'partial',
          generation_error:  "Some skills could not be saved (#{outcome[:failed]}): #{outcome[:errors].first(3).join('; ')}"
        )
        Rails.logger.warn("[N10] Portfolio partially generated for session #{@session.id}: #{outcome[:errors].join('; ')}")
      else
        # Everything failed: mark failed (not a fake 'partial') with a clear message.
        # Deliberately NOT raising: status is already final and Sidekiq retries would
        # re-ask the same LLM for the same malformed data.
        portfolio.update!(
          generation_status: 'failed',
          generation_error:  "All skills failed to save: #{outcome[:errors].first(3).join('; ')}"
        )
        Rails.logger.error("[N10] Portfolio skills all failed for session #{@session.id}: #{outcome[:errors].join('; ')}")
      end

      portfolio
    rescue => e
      portfolio&.update!(generation_status: 'failed', generation_error: e.message)
      Rails.logger.error("[N10] Portfolio generation failed for session #{@session.id}: #{e.class} #{e.message}")
      raise
    end

    private

    def generation_input_error
      return NO_ASSESSMENT_SKILLS_ERROR unless @session.assessment.assessment_skills.exists?
      return NO_COVERAGE_ERROR unless @session.coverage_maps.exists?

      nil
    end

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

      transcript_text = turns.map do |turn|
        "[TURN #{turn.turn_number}][#{turn.speaker.upcase}]: #{turn.text}"
      end.join("\n")

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
           For each quote, include the explicit TURN number shown in the transcript.
           Copy the candidate's words exactly; do not paraphrase or invent evidence.
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
              "evidence": [
                { "turn_number": 14, "quote": "exact candidate excerpt" }
              ],
              "competency_summary": "2-3 sentence summary"
            }
          ],
          "discovered_skills": [
            {
              "skill_label": "Micro-frontend Architecture",
              "level": 2,
              "confidence": "low",
              "evidence": [
                { "turn_number": 21, "quote": "exact candidate excerpt" }
              ],
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

    # Saves every skill individually (best-effort): valid skills are persisted,
    # invalid ones are collected as errors. Returns { saved:, failed:, errors: }
    # so the caller can decide the final generation_status.
    def save_skills(portfolio, response)
      data = response.is_a?(Hash) ? response : JSON.parse(response)
      skill_attrs = build_skill_attrs(data)

      if skill_attrs.empty?
        raise EmptyAiOutputError, 'AI returned no skill assessments'
      end

      # Destroy existing skills (idempotent regeneration)
      portfolio.portfolio_skills.destroy_all

      saved  = 0
      errors = []

      skill_attrs.each do |attrs|
        portfolio.portfolio_skills.create!(attrs)
        saved += 1
      rescue ActiveRecord::ActiveRecordError => e
        errors << skill_error_message(attrs, e)
      end

      { saved: saved, failed: errors.size, errors: errors }
    end

    def build_skill_attrs(data)
      configured = (data['configured_skills'] || []).map do |skill_data|
        {
          skill_id:           skill_data['skill_id'],
          skill_label:        skill_data['skill_label'],
          is_discovered:      false,
          ai_level:           skill_data['level'].to_i.clamp(1, 5),
          ai_confidence:      normalize_confidence(skill_data['confidence']),
          evidence:           validated_evidence(skill_data),
          competency_summary: skill_data['competency_summary']
        }
      end

      discovered = (data['discovered_skills'] || []).map do |skill_data|
        {
          skill_id:           nil,
          skill_label:        skill_data['skill_label'],
          is_discovered:      true,
          ai_level:           skill_data['level'].to_i.clamp(1, 5),
          ai_confidence:      normalize_confidence(skill_data['confidence']),
          evidence:           validated_evidence(skill_data),
          competency_summary: skill_data['competency_summary']
        }
      end

      configured + discovered
    end

    def validated_evidence(skill_data)
      result = evidence_validator.call(skill_data['evidence'])
      if result[:rejections].any?
        Rails.logger.warn(
          "Portfolio evidence rejected for session #{@session.id}: #{result[:rejections].map { |reason, count| "#{reason}=#{count}" }.join(', ')}"
        )
      end
      result[:citations]
    end

    def evidence_validator
      @evidence_validator ||= EvidenceValidator.new(session: @session)
    end

    # Maps arbitrary LLM confidence output onto the confidence_level enum
    # (high/medium/low). Blank and unknown values fall back to 'medium' so a
    # single odd field can never sink the whole generation (F-08).
    def normalize_confidence(raw)
      value = raw.to_s.strip.downcase
      return 'medium' if value.empty?
      return 'high'   if value.start_with?('high')
      return 'low'    if value.start_with?('low')
      return 'medium' if value.start_with?('medium')

      'medium'
    end

    def skill_error_message(attrs, error)
      label = attrs[:skill_label].presence || attrs[:skill_id].presence || 'unknown skill'
      details = error.respond_to?(:record) ? error.record.errors.full_messages.join(', ') : error.message
      "#{label}: #{details}"
    end
  end
end
