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

      # 1. Check for empty transcript
      candidate_turns = @session.transcript_turns.where(speaker: 'candidate')
      if @session.transcript_turns.empty? || candidate_turns.empty? || candidate_turns.all? { |t| t.text.blank? }
        portfolio.update!(
          generation_status: 'failed',
          context_status:    'empty_transcript',
          context_notes:     'Sesi interview tidak memiliki rekaman percakapan atau transkrip kosong. Kandidat belum memberikan respon atau sesi langsung diakhiri.',
          generation_error:  'Transkrip interview kosong. Kandidat belum memberikan jawaban yang dapat dinilai.'
        )
        Rails.logger.warn("[N10] Portfolio generation skipped for session #{@session.id}: empty transcript")
        return portfolio
      end

      portfolio.update!(generation_status: 'generating')

      prompt   = build_prompt
      response = @gemini_client.generate_content(prompt, temperature: 0.2)

      save_skills(portfolio, response)
      portfolio.update!(
        generation_status: 'complete',
        generated_at:      Time.current,
        generation_error:  nil
      )

      Rails.logger.info("[N10] Portfolio generated for session #{@session.id} (context: #{portfolio.context_status})")
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

        1. RELEVANCE & CONTEXT CHECK:
           Evaluate whether the candidate's answers actually pertain to the interview for #{assessment.name}.
           If the candidate's responses are completely nonsensical, off-topic, gibberish, or entirely unrelated to the role being assessed, flag:
           "context_status": "out_of_context",
           "context_notes": "Explain why the candidate's answers are outside the context of #{assessment.name}"
           Otherwise, set:
           "context_status": "relevant",
           "context_notes": null

        2. FOR EACH SKILL (configured and discovered):
           - FIND THE EVIDENCE: 2-3 most revealing quotes from the CANDIDATE.
           - ASSIGN A LEVEL: L1 to L5 based on anchors.
           - WRITE THE COMPETENCY SUMMARY: 2-3 sentences.
           - ASSIGN CONFIDENCE: high, medium, or low.

        OUTPUT (JSON only, no prose):
        {
          "context_status": "relevant",
          "context_notes": null,
          "configured_skills": [
            {
              "skill_id": "sk-eng-001",
              "skill_label": "Skill Name",
              "level": 3,
              "confidence": "high",
              "evidence": ["quote 1", "quote 2"],
              "competency_summary": "2-3 sentence summary"
            }
          ],
          "discovered_skills": [
            {
              "skill_label": "Discovered Skill",
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

      # Save context relevance status
      is_out_of_context = data['context_status'].to_s == 'out_of_context'
      portfolio.update!(
        context_status: is_out_of_context ? 'out_of_context' : 'relevant',
        context_notes:  data['context_notes'].presence
      )

      # Destroy existing skills (idempotent regeneration)
      portfolio.portfolio_skills.destroy_all

      (data['configured_skills'] || []).each do |skill_data|
        portfolio.portfolio_skills.create!(
          skill_id:           skill_data['skill_id'],
          skill_label:        skill_data['skill_label'],
          is_discovered:      false,
          ai_level:           skill_data['level'].to_i.clamp(1, 5),
          ai_confidence:      skill_data['confidence'],
          evidence:           Array(skill_data['evidence']).first(3),
          competency_summary: skill_data['competency_summary']
        )
      end

      (data['discovered_skills'] || []).each do |skill_data|
        portfolio.portfolio_skills.create!(
          skill_id:           nil,
          skill_label:        skill_data['skill_label'],
          is_discovered:      true,
          ai_level:           skill_data['level'].to_i.clamp(1, 5),
          ai_confidence:      skill_data['confidence'],
          evidence:           Array(skill_data['evidence']).first(3),
          competency_summary: skill_data['competency_summary']
        )
      end
    end
  end
end
