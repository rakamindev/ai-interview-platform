# frozen_string_literal: true

module Portfolios
  # N10: Generates a structured skill portfolio from the full transcript
  # and final coverage map using Gemini Pro.
  # Runs post-session as a background job.
  class Generator
    def initialize(session:, gemini_client: nil)
      @session = session
      model = ENV['GEMINI_PRO_MODEL'].presence || ENV.fetch('GEMINI_FLASH_MODEL', 'gemini-3.6-flash')
      @gemini_client = gemini_client || Gemini::HttpClient.new(
        model:   model,
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
      response = generate_with_fallback(prompt)

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

    def generate_with_fallback(prompt)
      initial_model = @gemini_client.instance_variable_get(:@model)
      models_to_try = [initial_model, ENV['GEMINI_FLASH_MODEL'], 'gemini-3.6-flash', 'gemini-flash-latest'].compact.uniq

      last_error = nil
      models_to_try.each_with_index do |model_name, idx|
        client = (idx == 0) ? @gemini_client : Gemini::HttpClient.new(model: model_name, timeout: 180)
        begin
          return client.generate_content(prompt, temperature: 0.2)
        rescue Gemini::HttpClient::RateLimitError, Gemini::HttpClient::ApiError => e
          last_error = e
          Rails.logger.warn("[N10] Model #{model_name} failed (#{e.message}), trying next fallback...")
          sleep 1 if idx < models_to_try.length - 1
        end
      end

      raise last_error if last_error
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
      data = if response.is_a?(Hash)
               response
             else
               cleaned = response.to_s.strip.sub(/\A```(?:json)?\s*/i, '').sub(/\s*```\z/, '')
               JSON.parse(cleaned)
             end

      # Destroy existing skills (idempotent regeneration)
      portfolio.portfolio_skills.destroy_all

      coverage_by_label = @session.coverage_maps.index_by { |m| m.skill_label.downcase }
      configured_from_ai = (data['configured_skills'] || []).index_by { |s| s['skill_label']&.downcase }

      # 1. Process all configured skills from assessment
      @session.assessment.assessment_skills.order(:display_order).each do |assessment_skill|
        skill_data = configured_from_ai[assessment_skill.skill_label.downcase] || {}
        map = coverage_by_label[assessment_skill.skill_label.downcase]

        # Check if skill was unassessed: probe_count 0 or state not_yet or no level provided
        is_unassessed = map.nil? || map.state == 'not_yet' || map.probe_count.to_i == 0 || skill_data['level'].blank?

        if is_unassessed
          portfolio.portfolio_skills.create!(
            skill_id:           assessment_skill.skill_id,
            skill_label:        assessment_skill.skill_label,
            is_discovered:      false,
            ai_level:           nil,
            ai_confidence:      nil,
            evidence:           [],
            competency_summary: skill_data['competency_summary'].presence || "Skill was not covered during this interview session."
          )
        else
          raw_level = skill_data['level'].to_i
          level = raw_level.between?(1, 5) ? raw_level : 1
          raw_conf = skill_data['confidence'].to_s.downcase.strip
          confidence = PortfolioSkill::CONFIDENCE_LEVELS.include?(raw_conf) ? raw_conf : 'low'

          portfolio.portfolio_skills.create!(
            skill_id:           assessment_skill.skill_id || skill_data['skill_id'],
            skill_label:        assessment_skill.skill_label,
            is_discovered:      false,
            ai_level:           level,
            ai_confidence:      confidence,
            evidence:           Array(skill_data['evidence']).first(3),
            competency_summary: skill_data['competency_summary'].presence || "Assessed at #{confidence} confidence."
          )
        end
      end

      # 2. Process discovered skills
      (data['discovered_skills'] || []).each do |skill_data|
        raw_level = skill_data['level'].to_i
        level = raw_level.between?(1, 5) ? raw_level : 1
        raw_conf = skill_data['confidence'].to_s.downcase.strip
        confidence = PortfolioSkill::CONFIDENCE_LEVELS.include?(raw_conf) ? raw_conf : 'low'

        portfolio.portfolio_skills.create!(
          skill_id:           nil,
          skill_label:        skill_data['skill_label'],
          is_discovered:      true,
          ai_level:           level,
          ai_confidence:      confidence,
          evidence:           Array(skill_data['evidence']).first(3),
          competency_summary: skill_data['competency_summary'].presence || "Discovered competency."
        )
      end
    end
  end
end
