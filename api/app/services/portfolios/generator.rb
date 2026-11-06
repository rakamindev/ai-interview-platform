# frozen_string_literal: true

module Portfolios
  # N10: Generates a structured skill portfolio from the full transcript
  # and final coverage map using Gemini Pro.
  # Runs post-session as a background job.
  class Generator
    PROMPT_VERSION = 'n10-v1'

    class InvalidOutput < StandardError; end

    # Malformed model output is usually random, so one more try is reasonable; repeating it six times
    # rarely helps and wastes calls.
    MAX_INVALID_OUTPUT_ATTEMPTS = 2

    def self.requested_model
      ENV.fetch('GEMINI_PRO_MODEL', 'gemini-2.0-pro-001')
    end

    # Short, non-secret fingerprint of everything an administrator might change to fix a failure that
    # retrying cannot fix: the model, the endpoint and the credential. The key itself is never stored,
    # only a hash inside the hash.
    def self.config_fingerprint
      key_digest = Digest::SHA256.hexdigest(ENV.fetch('GEMINI_API_KEY', ''))
      Digest::SHA256.hexdigest([requested_model, Gemini::HttpClient::BASE_URL, key_digest].join('|'))[0, 16]
    end

    def initialize(generation:, gemini_client: nil)
      @generation = generation
      @portfolio  = generation.portfolio
      @session    = @portfolio.session
      @gemini_client = gemini_client || Gemini::HttpClient.new(
        model:   @generation.requested_model.presence || self.class.requested_model,
        timeout: 180 # up to 3 minutes for large transcripts
      )
    end

    # Runs one generation. Returns the generation in its resulting state.
    # Raises on transient errors so Sidekiq retries the SAME generation.
    def call
      return @generation unless claim!

      response = @gemini_client.generate_content(build_prompt, temperature: 0.2)
      data     = parse(response)
      publish!(data)
      @generation
    rescue Gemini::HttpClient::ApiError => e # includes RateLimitError and TimeoutError
      result = ProviderError.classify(e)
      unless result.temporary?
        # Returning normally (not raising) tells Sidekiq the job is done: no automatic retries are
        # spent on something only an administrator can fix.
        fail!(result.code, result.provider_message)
        return @generation
      end

      mark_retrying!(result.code, result.provider_message)
      raise
    rescue InvalidOutput => e
      if invalid_output_attempts + 1 >= MAX_INVALID_OUTPUT_ATTEMPTS # this attempt is the last one allowed
        fail!('invalid_output', e.message)
        return @generation
      end

      mark_retrying!('invalid_output', e.message)
      raise
    end

    # Called by the worker when Sidekiq gives up retrying. Only a run still waiting for its retry
    # ("retrying") is failed: if another worker has reclaimed it ("running"), that worker owns it.
    def self.mark_exhausted!(generation, message)
      new(generation: generation, gemini_client: :unused).send(:fail!, 'retries_exhausted', message,
                                                               only_if_status: 'retrying')
    end

    private

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

    # Moves the generation from queued/retrying (or a stale "running") to running. Returns false when
    # another worker holds it or it already finished, so duplicate or late jobs do nothing (A5).
    def claim!
      claimable = PortfolioGeneration.where(id: @generation.id)
                                     .where('status IN (?) OR (status = ? AND started_at < ?)',
                                            %w[queued retrying], 'running',
                                            PortfolioGeneration::STALE_RUNNING_AFTER.ago)
      claimed = claimable.update_all(['status = ?, started_at = ?, error_code = NULL, claim_count = claim_count + 1',
                                      'running', Time.current]) == 1
      @generation.reload
      return false unless claimed

      # Nobody else can claim a freshly started run for STALE_RUNNING_AFTER, so this is our token.
      @claim_count = @generation.claim_count

      @portfolio.update!(generation_status: 'generating') unless @portfolio.current_generation_id
      true
    end

    def parse(response)
      data = response.is_a?(Hash) ? response : JSON.parse(response.to_s)
      raise InvalidOutput, 'Model output is not a JSON object' unless data.is_a?(Hash)

      data
    rescue JSON::ParserError
      raise InvalidOutput, 'Model output is not valid JSON'
    end

    # Publication (design §2, I1/I2): inside one transaction holding the portfolio row lock, a
    # generation becomes current only if it is newer than the current one. Otherwise it is kept as
    # "superseded" and nothing visible changes. Skill rows are inserted for this generation only;
    # earlier generations are never deleted, so a failure here leaves the published result intact.
    def publish!(data)
      Portfolio.transaction do
        @portfolio.lock!
        @generation.reload
        next if @generation.terminal?
        next if lost_claim? # reclaimed by another worker after STALE_RUNNING_AFTER: its result wins

        current = @portfolio.current_generation
        if current && current.sequence > @generation.sequence
          @generation.update!(status: 'superseded', finished_at: Time.current)
          next
        end

        insert_skills!(data)
        carry_overrides_forward!
        @portfolio.update!(current_generation: @generation, generation_status: 'complete',
                           generated_at: Time.current, generation_error: nil)
        @generation.update!(status: 'succeeded', finished_at: Time.current, **provider_meta)
      end
    end

    # G3: move every human override onto this generation's skill with the same identity. The human
    # level is never changed. If the AI now proposes a different level than the one the assessor saw,
    # or the skill is gone, the override is flagged so a person looks at it again. An override is never
    # attached to a different skill, however similar its name.
    #
    # Older data may hold several decisions for one skill (from before one-decision-per-skill). The
    # newest carries forward and is flagged as conflicting; the others stay on their original rows,
    # flagged as superseded. No human decision is deleted.
    def carry_overrides_forward!
      new_skills = @generation.portfolio_skills.reload.index_by(&:skill_key)
      overrides  = AssessorOverride.joins(:portfolio_skill)
                                   .where(portfolio_skills: { portfolio_id: @portfolio.id })
                                   .where.not(portfolio_skills: { generation_id: @generation.id })
                                   .includes(:portfolio_skill).to_a

      overrides.group_by { |o| o.portfolio_skill.skill_key }.each do |skill_key, decisions|
        # Tie-break rule: the latest overridden_at wins; if two timestamps are identical, the higher
        # id (the decision recorded later) wins. Deterministic, and covered by a test.
        newest, *older = decisions.sort_by { |o| [o.overridden_at || Time.at(0), o.id] }.reverse
        older.each { |o| o.update!(needs_review: true, review_reason: 'superseded_by_newer_decision') }

        new_skill = new_skills[skill_key]
        if new_skill.nil?
          newest.update!(needs_review: true, review_reason: 'skill_missing_in_current')
        elsif older.any?
          newest.update!(portfolio_skill_id: new_skill.id, needs_review: true, review_reason: 'conflicting_decisions')
        else
          changed = new_skill.ai_level != newest.ai_level
          newest.update!(portfolio_skill_id: new_skill.id, needs_review: changed,
                         review_reason: changed ? 'ai_level_changed' : nil)
        end
      end
    end

    def provider_meta
      meta = @gemini_client.respond_to?(:last_response_meta) ? @gemini_client.last_response_meta : nil
      { served_model: meta&.dig(:served_model), provider_response_id: meta&.dig(:response_id) }
    end

    def insert_skills!(data)
      seen = Set.new
      (data['configured_skills'] || []).each do |skill_data|
        add_skill(skill_data, discovered: false, seen: seen)
      end
      (data['discovered_skills'] || []).each do |skill_data|
        add_skill(skill_data, discovered: true, seen: seen)
      end
    end

    def add_skill(skill_data, discovered:, seen:)
      key = skill_key(skill_data, discovered)
      return if key.nil? || !seen.add?(key)

      @portfolio.all_portfolio_skills.create!(
        generation:         @generation,
        skill_key:          key,
        skill_id:           discovered ? nil : skill_data['skill_id'],
        skill_label:        skill_data['skill_label'],
        is_discovered:      discovered,
        ai_level:           skill_data['level'].to_i.clamp(1, 5),
        ai_confidence:      skill_data['confidence'],
        evidence:           Array(skill_data['evidence']).first(3),
        competency_summary: skill_data['competency_summary']
      )
    end

    # Stable identity for a skill across generations, used to carry human overrides forward.
    def skill_key(skill_data, discovered)
      label = skill_data['skill_label'].to_s
      return nil if label.strip.empty?
      return "discovered:#{normalize_label(label)}" if discovered

      configured = configured_skills.find do |s|
        (s.skill_id.present? && s.skill_id == skill_data['skill_id']) || s.skill_label.casecmp?(label)
      end
      configured ? "assessment_skill:#{configured.id}" : "label:#{normalize_label(label)}"
    end

    def configured_skills
      @configured_skills ||= @session.assessment.assessment_skills.to_a
    end

    def normalize_label(label)
      label.downcase.gsub(/[^a-z0-9]+/, ' ').strip
    end

    # True when this worker claimed the run but another worker has since reclaimed it. Every state
    # change a worker makes (publish, retrying, failed) is fenced by this check. The retries-exhausted
    # path never claimed (@claim_count is nil) and may always fail the run.
    def lost_claim?
      !@claim_count.nil? && @generation.claim_count != @claim_count
    end

    # Only the worker that still owns the claim may move the run back to "retrying". If another
    # worker reclaimed it (claim_count moved on) or already published/failed it, this does nothing.
    def mark_retrying!(code, message)
      validation = @generation.validation.merge(
        'invalid_output_attempts' => invalid_output_attempts + (code == 'invalid_output' ? 1 : 0)
      )
      moved = PortfolioGeneration.where(id: @generation.id, status: 'running', claim_count: @claim_count)
                                 .update_all(status: 'retrying', error_code: code, validation: validation,
                                             error_message: message.to_s.truncate(500))
      @generation.reload
      # A retry is coming, so this is "still in progress" for the assessor, not "failed".
      @portfolio.update!(generation_status: 'generating') if moved == 1 && !@portfolio.reload.current_generation_id
    end

    def invalid_output_attempts
      @generation.validation.fetch('invalid_output_attempts', 0).to_i
    end

    def fail!(code, message, only_if_status: nil)
      Portfolio.transaction do
        @portfolio.lock!
        @generation.reload
        next if @generation.terminal?
        next if lost_claim?
        next if only_if_status && @generation.status != only_if_status

        @generation.update!(status: 'failed', error_code: code, error_message: message.to_s.truncate(500),
                            finished_at: Time.current)
        sync_failure_status!(message)
      end
    end

    # Legacy column: only reflects a failure when nothing has been published yet. With a published
    # generation the portfolio stays "complete" and the failure is reported on the generation.
    def sync_failure_status!(message)
      return if @portfolio.reload.current_generation_id

      @portfolio.update!(generation_status: 'failed', generation_error: message.to_s.truncate(500))
    end
  end
end
