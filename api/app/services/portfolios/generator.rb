# frozen_string_literal: true

require 'set'

module Portfolios
  # N10: Generates a structured skill portfolio from the full transcript
  # and final coverage map using Gemini Pro.
  # Runs post-session as a background job.
  class Generator
    VALID_ERROR_CODES = %w[
      model_timeout
      model_unavailable
      model_not_found
      invalid_model_output
      model_output_truncated
    ].freeze

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

      # AC-G5: Row lock & single process
      already_running = false
      portfolio.with_lock do
        if portfolio.generating?
          already_running = true
        else
          portfolio.update!(generation_status: 'generating')
        end
      end

      if already_running
        Rails.logger.warn("[N10] Portfolio generation already in progress for session #{@session.id} — skipped_duplicate")
        return portfolio
      end

      prompt   = build_prompt
      response = @gemini_client.generate_content(prompt, temperature: 0.2)

      # AC-G6: Atomic write in single transaction
      Portfolio.transaction do
        portfolio.with_lock do
          save_skills(portfolio, response)
          portfolio.update!(
            generation_status: 'complete',
            generated_at:      Time.current,
            generation_error:  nil
          )
        end
      end

      Rails.logger.info("[N10] Portfolio generated for session #{@session.id}")
      portfolio
    rescue => e
      error_code = map_generation_error(e)
      Rails.logger.error("[N10] Portfolio generation failed for session #{@session.id}: #{e.class} #{e.message} (code: #{error_code})")

      # AC-G6 & AC-G7: If previously complete, keep complete; store standard error code
      if portfolio
        portfolio.with_lock do
          final_status = portfolio.generated_at.present? ? 'complete' : 'failed'
          portfolio.update!(
            generation_status: final_status,
            generation_error:  error_code
          )
        end
      end
      raise
    end

    private

    def map_generation_error(error)
      msg = error.message.to_s
      case error
      when Gemini::HttpClient::TimeoutError, Faraday::TimeoutError, Timeout::Error
        'model_timeout'
      when Gemini::HttpClient::RateLimitError
        'model_unavailable'
      when Gemini::HttpClient::ApiError
        if error.status == 404 || msg.include?('404') || msg.downcase.include?('not found')
          'model_not_found'
        elsif error.status == 429 || (error.status && error.status >= 500)
          'model_unavailable'
        elsif msg.include?('MAX_TOKENS') || msg.downcase.include?('truncated')
          'model_output_truncated'
        else
          'model_unavailable'
        end
      when JSON::ParserError
        'invalid_model_output'
      else
        if msg.include?('MAX_TOKENS') || msg.downcase.include?('truncated')
          'model_output_truncated'
        elsif msg.downcase.include?('timeout')
          'model_timeout'
        elsif msg.include?('404')
          'model_not_found'
        elsif msg.include?('429') || msg.include?('503') || msg.include?('500')
          'model_unavailable'
        else
          'invalid_model_output'
        end
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

    # Normalization per AC-G3: lowercase, squish whitespace, strip leading/trailing punctuation
    def normalize_quote(str)
      return '' if str.blank?

      str.to_s.downcase.gsub(/\s+/, ' ').strip.sub(/\A[[:punct:]\s]+/, '').sub(/[[:punct:]\s]+\z/, '')
    end

    # Candidate quotes verification per AC-G3
    def filter_valid_quotes(raw_quotes, candidate_turns_normalized)
      valid = []
      seen_normalized = Set.new

      Array(raw_quotes).each do |quote|
        norm = normalize_quote(quote)
        next if norm.blank?
        next if seen_normalized.include?(norm)

        # Must appear as substring in at least one candidate turn
        matches = candidate_turns_normalized.any? { |turn| turn.include?(norm) }
        if matches
          valid << quote.to_s.strip
          seen_normalized.add(norm)
          break if valid.size >= 3
        end
      end

      valid
    end

    # AC-G2: Accept only 1..5 or "1".."5". Any other value is :invalid
    def parse_valid_level(raw)
      return nil if raw.nil?

      if raw.is_a?(Integer) && raw.between?(1, 5)
        raw
      elsif raw.is_a?(String) && raw.strip =~ /\A[1-5]\z/
        raw.strip.to_i
      else
        :invalid
      end
    end

    def find_llm_entry(list, label, skill_id)
      return nil if list.blank?

      if skill_id.present?
        match = list.find { |s| s['skill_id'].to_s == skill_id.to_s }
        return match if match
      end

      target = label.to_s.strip.downcase
      list.find { |s| s['skill_label'].to_s.strip.downcase == target }
    end

    # AC-G4 & AC-G1 & AC-G2 & AC-G3:
    # Update skills in-place, preserving overrides.
    def save_skills(portfolio, response)
      data = response.is_a?(Hash) ? response : JSON.parse(response)
      raise JSON::ParserError, "Model response is not a JSON object" unless data.is_a?(Hash)

      assessment        = @session.assessment
      configured_skills = assessment.assessment_skills.order(:display_order).to_a
      coverage_maps     = @session.coverage_maps.to_a

      # Candidate turns only for quote verification (AC-G3)
      candidate_turns = @session.transcript_turns.where(speaker: 'candidate').pluck(:text)
      candidate_turns_normalized = candidate_turns.map { |t| normalize_quote(t) }.reject(&:blank?)

      # Deduplicate LLM configured skills: first occurrence wins (AC-G2)
      raw_configured_skills = Array(data['configured_skills'])
      deduped_configured_skills = []
      seen_configured_keys = Set.new
      raw_configured_skills.each do |entry|
        next unless entry.is_a?(Hash)

        key = entry['skill_id'].presence || entry['skill_label'].to_s.strip.downcase
        unless seen_configured_keys.include?(key)
          deduped_configured_skills << entry
          seen_configured_keys.add(key)
        end
      end

      touched_skill_ids = Set.new

      configured_skills.each do |cfg_skill|
        # Match coverage map
        cmap = coverage_maps.find do |m|
          (m.skill_id.present? && cfg_skill.skill_id.present? && m.skill_id == cfg_skill.skill_id) ||
            m.skill_label.to_s.strip.downcase == cfg_skill.skill_label.to_s.strip.downcase
        end

        # Match LLM output
        llm_entry = find_llm_entry(deduped_configured_skills, cfg_skill.skill_label, cfg_skill.skill_id)

        status, reason, level, confidence, quotes, summary = classify_skill(
          cmap: cmap,
          llm_entry: llm_entry,
          candidate_turns_normalized: candidate_turns_normalized
        )

        record = upsert_portfolio_skill(
          portfolio:          portfolio,
          skill_id:           cfg_skill.skill_id,
          skill_label:        cfg_skill.skill_label,
          is_discovered:      false,
          assessment_status:  status,
          status_reason:      reason,
          ai_level:           level,
          ai_confidence:      confidence,
          evidence:           quotes,
          competency_summary: summary
        )
        touched_skill_ids.add(record.id)
      end

      # Discovered skills handling (AC-G2)
      raw_discovered_skills = Array(data['discovered_skills'])
      raw_discovered_skills.each do |disc_entry|
        next unless disc_entry.is_a?(Hash)

        disc_label = disc_entry['skill_label'].to_s.strip
        next if disc_label.blank?

        cmap = coverage_maps.find do |m|
          m.is_discovered? && m.skill_label.to_s.strip.downcase == disc_label.downcase
        end

        if cmap.nil?
          Rails.logger.info("[N10] Discovered skill '#{disc_label}' not found in session coverage map — ignored")
          next
        end

        status, reason, level, confidence, quotes, summary = classify_skill(
          cmap: cmap,
          llm_entry: disc_entry,
          candidate_turns_normalized: candidate_turns_normalized
        )

        record = upsert_portfolio_skill(
          portfolio:          portfolio,
          skill_id:           nil,
          skill_label:        disc_label,
          is_discovered:      true,
          assessment_status:  status,
          status_reason:      reason,
          ai_level:           level,
          ai_confidence:      confidence,
          evidence:           quotes,
          competency_summary: summary
        )
        touched_skill_ids.add(record.id)
      end

      # AC-G4: Handle previously existing skills that are no longer configured.
      # Only delete if they have NO override. If they have an override, keep with status not_assessed.
      portfolio.portfolio_skills.each do |existing_ps|
        next if touched_skill_ids.include?(existing_ps.id)

        if existing_ps.assessor_override.present?
          existing_ps.update!(
            assessment_status:  'not_assessed',
            status_reason:      'not_covered',
            ai_level:           nil,
            ai_confidence:      nil,
            competency_summary: existing_ps.competency_summary.presence || 'This skill was not evaluated during the session.'
          )
        else
          existing_ps.destroy!
        end
      end
    end

    # Deterministic classification per AC-G1 & AC-G2 & AC-G3
    def classify_skill(cmap:, llm_entry:, candidate_turns_normalized:)
      # Rule 1: No coverage map or not_yet or probe_count = 0 -> not_assessed (not_covered)
      # Classification always trumps LLM claim!
      if cmap.nil? || cmap.state == 'not_yet' || cmap.probe_count.to_i == 0
        return [
          'not_assessed',
          'not_covered',
          nil,
          nil,
          [],
          llm_entry&.dig('competency_summary').presence || 'This skill was not evaluated during the session.'
        ]
      end

      # Rule 2: Missing from LLM output
      if llm_entry.nil?
        return [
          'not_assessed',
          'missing_from_model_output',
          nil,
          nil,
          [],
          'Skill was missing from the evaluation model output.'
        ]
      end

      # Rule 3: Invalid level in LLM output
      raw_level = llm_entry['level']
      level = parse_valid_level(raw_level)
      if level == :invalid || level.nil?
        return [
          'not_assessed',
          'invalid_model_output',
          nil,
          nil,
          [],
          llm_entry['competency_summary'].presence || 'Evaluation model produced invalid level output.'
        ]
      end

      # Verify candidate quotes
      raw_quotes = llm_entry['evidence']
      valid_quotes = filter_valid_quotes(raw_quotes, candidate_turns_normalized)

      # Rule 4: No valid quotes found
      if valid_quotes.empty?
        return [
          'not_assessed',
          'no_valid_evidence',
          nil,
          nil,
          [],
          llm_entry['competency_summary'].presence || 'No verifiable candidate quotes were found in transcript.'
        ]
      end

      # Confidence sanitization (AC-G2)
      raw_conf = llm_entry['confidence'].to_s.downcase.strip
      confidence = %w[high medium low].include?(raw_conf) ? raw_conf : 'low'

      # Rule 5: Insufficient evidence (initiated, probe_count < 2, or only 1 valid quote)
      if cmap.state == 'initiated' || cmap.probe_count < 2 || valid_quotes.size == 1
        summary = llm_entry['competency_summary'].presence || 'Skill observed with limited probe depth or evidence.'
        return ['insufficient_evidence', nil, level, 'low', valid_quotes, summary]
      end

      # Rule 6: Assessed (partial or covered, probe_count >= 2, and min 2 valid quotes)
      if %w[partial covered].include?(cmap.state) && cmap.probe_count >= 2 && valid_quotes.size >= 2
        summary = llm_entry['competency_summary'].presence || 'Skill evaluated with sufficient probe depth and evidence.'
        return ['assessed', nil, level, confidence, valid_quotes, summary]
      end

      # Fallback
      summary = llm_entry['competency_summary'].presence || 'Skill observed with limited probe depth.'
      ['insufficient_evidence', nil, level, 'low', valid_quotes, summary]
    end

    def upsert_portfolio_skill(portfolio:, skill_id:, skill_label:, is_discovered:, assessment_status:, status_reason:, ai_level:, ai_confidence:, evidence:, competency_summary:)
      existing = portfolio.portfolio_skills.find do |ps|
        (skill_id.present? && ps.skill_id.present? && ps.skill_id == skill_id) ||
          ps.skill_label.to_s.strip.downcase == skill_label.to_s.strip.downcase
      end

      attrs = {
        skill_id:           skill_id,
        skill_label:        skill_label,
        is_discovered:      is_discovered,
        assessment_status:  assessment_status,
        status_reason:      status_reason,
        ai_level:           ai_level,
        ai_confidence:      ai_confidence,
        evidence:           evidence,
        competency_summary: competency_summary
      }

      if existing
        existing.update!(attrs)
        existing
      else
        portfolio.portfolio_skills.create!(attrs)
      end
    end
  end
end
