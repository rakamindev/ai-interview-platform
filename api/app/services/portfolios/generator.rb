# frozen_string_literal: true

module Portfolios
  # N10: Generates a structured skill portfolio from the full transcript
  # and final coverage map using Gemini Pro.
  # Runs post-session as a background job.
  #
  # The model proposes levels, quotes and summaries. This class decides what is
  # allowed to stick:
  #   - a skill the interview never reached gets no level (not_assessed)
  #   - a level must be 1-5 and backed by at least one quote the candidate
  #     really said, otherwise the skill is insufficient_evidence
  #   - confidence comes from the coverage map, not from the model
  class Generator
    class InvalidResponseError < StandardError; end

    MAX_EVIDENCE        = 3
    MAX_SUMMARY_LENGTH  = 2000
    NOT_ASSESSED_SUMMARY = 'The interview did not reach this skill, so no rating was given. ' \
                           'It is not counted for or against the candidate.'
    INSUFFICIENT_SUMMARY = 'This skill came up, but the interview did not produce evidence that ' \
                           'supports a rating. It is not counted for or against the candidate.'

    def initialize(session:, gemini_client: nil)
      @session = session
      @gemini_client = gemini_client
    end

    # Returns the Portfolio record with skills populated.
    def call
      portfolio = find_or_create_portfolio

      unless portfolio.claim_for_generation!
        Rails.logger.info("[N10] Portfolio #{portfolio.id} is #{portfolio.generation_status}; skipping duplicate job")
        return portfolio
      end

      @claimed = true
      ratings = build_ratings

      ActiveRecord::Base.transaction do
        save_ratings(portfolio, ratings)
        portfolio.update!(generation_status: 'complete', generated_at: Time.current, generation_error: nil)
      end

      Rails.logger.info("[N10] Portfolio generated for session #{@session.id}")
      portfolio
    rescue StandardError => e
      if @claimed
        portfolio.update_columns(generation_status: 'failed', generation_error: safe_error_message(e))
      end
      Rails.logger.error("[N10] Portfolio generation failed for session #{@session.id}: #{safe_error_message(e)}")
      raise
    end

    private

    def gemini_client
      @gemini_client ||= Gemini::HttpClient.new(
        model:   ENV.fetch('GEMINI_PRO_MODEL', 'gemini-2.0-pro-001'),
        timeout: 180 # up to 3 minutes for large transcripts
      )
    end

    def find_or_create_portfolio
      @session.portfolio || @session.create_portfolio!(
        candidate_id:      @session.candidate_id,
        generation_status: 'pending'
      )
    rescue ActiveRecord::RecordNotUnique
      @session.reload.portfolio
    end

    # ── Deciding the ratings ──────────────────────────────────────────────────

    def build_ratings
      configured = @session.assessment.assessment_skills.order(:display_order).to_a
      coverage   = @session.coverage_maps.to_a
      turns      = @session.transcript_turns.ordered.to_a

      configured_coverage = coverage.reject(&:is_discovered)
      discovered_coverage = coverage.select(&:is_discovered)

      candidate_spoke = turns.any? { |t| t.speaker == 'candidate' }
      coverage_for = configured.to_h { |skill| [skill, find_coverage(configured_coverage, skill)] }
      # If the candidate never spoke (mic failure, instant drop-off), the AI
      # asking about a skill doesn't make it assessed.
      assessable   = candidate_spoke ? configured.select { |skill| reached?(coverage_for[skill]) } : []

      response =
        if candidate_spoke && (assessable.any? || discovered_coverage.any?)
          request_model_ratings(assessable, coverage, turns)
        else
          # Nothing the candidate said can support a rating; don't ask the model to invent one.
          { 'configured_skills' => [], 'discovered_skills' => [] }
        end

      matcher = EvidenceMatcher.new(turns)

      configured_ratings = configured.map do |skill|
        cov = coverage_for[skill]
        base = {
          skill_id:       skill.skill_id,
          skill_label:    skill.skill_label,
          is_discovered:  false,
          probe_count:    cov&.probe_count || 0,
          coverage_state: cov&.state || 'not_yet'
        }

        next base.merge(unrated('not_assessed', NOT_ASSESSED_SUMMARY)) unless assessable.include?(skill)

        proposal = find_proposal(response['configured_skills'], skill.skill_id, skill.skill_label)
        base.merge(rate(proposal, cov, matcher))
      end

      configured_labels = configured.map { |s| PortfolioSkill.normalize_label(s.skill_label) }

      discovered_ratings = Array(response['discovered_skills']).filter_map do |proposal|
        next unless proposal.is_a?(Hash) && proposal['skill_label'].present?

        label = proposal['skill_label'].to_s.strip.truncate(255)
        next if configured_labels.include?(PortfolioSkill.normalize_label(label))

        cov = discovered_coverage.find { |c| same_label?(c.skill_label, label) }
        rating = rate(proposal, cov, matcher)
        # An unrated discovered skill is noise: nobody asked for it.
        next unless rating[:rating_status] == 'rated'

        {
          skill_id:       nil,
          skill_label:    label,
          is_discovered:  true,
          probe_count:    cov&.probe_count || 0,
          coverage_state: cov&.state
        }.merge(rating)
      end

      configured_ratings + discovered_ratings.uniq { |r| PortfolioSkill.normalize_label(r[:skill_label]) }
    end

    def rate(proposal, coverage, matcher)
      return unrated('insufficient_evidence', INSUFFICIENT_SUMMARY) unless proposal.is_a?(Hash)

      level = parse_level(proposal['level'])
      evidence = Array(proposal['evidence']).filter_map { |quote| matcher.match(quote) }
                                             .uniq { |e| e[:quote] }
                                             .first(MAX_EVIDENCE)

      return unrated('insufficient_evidence', INSUFFICIENT_SUMMARY) if level.nil? || evidence.empty?

      summary = proposal['competency_summary'].to_s.strip
      summary = 'No summary was provided.' if summary.empty?

      {
        rating_status:      'rated',
        ai_level:           level,
        ai_confidence:      confidence_for(coverage),
        evidence:           evidence,
        competency_summary: summary.truncate(MAX_SUMMARY_LENGTH)
      }
    end

    def unrated(status, summary)
      { rating_status: status, ai_level: nil, ai_confidence: 'low', evidence: [], competency_summary: summary }
    end

    # Accepts 3, 3.0, "3" and "L3". Anything else (nil, 0, 7, "three") is no level.
    def parse_level(value)
      level =
        case value
        when Integer then value
        when Float   then value.to_i if value == value.to_i
        when String  then value.strip[/\AL?([1-5])\z/i, 1]&.to_i
        end

      level if level&.between?(1, 5)
    end

    # PRD 01 §5: high = covered with 3+ probes; low = 1 probe or still initiated;
    # medium otherwise. Where the PRD rules overlap we take the lower one.
    def confidence_for(coverage)
      return 'low' if coverage.nil?
      return 'high' if coverage.state == 'covered' && coverage.probe_count >= 3
      return 'low' if coverage.probe_count <= 1 || coverage.state == 'initiated'

      'medium'
    end

    def reached?(coverage)
      coverage.present? && coverage.state != 'not_yet' && coverage.probe_count.positive?
    end

    def find_coverage(rows, skill)
      (skill.skill_id.present? && rows.find { |c| c.skill_id == skill.skill_id }) ||
        rows.find { |c| same_label?(c.skill_label, skill.skill_label) }
    end

    def find_proposal(proposals, skill_id, label)
      list = Array(proposals).select { |p| p.is_a?(Hash) }
      (skill_id.present? && list.find { |p| p['skill_id'].to_s == skill_id.to_s }) ||
        list.find { |p| same_label?(p['skill_label'], label) }
    end

    def same_label?(a, b)
      PortfolioSkill.normalize_label(a) == PortfolioSkill.normalize_label(b)
    end

    # ── Saving ────────────────────────────────────────────────────────────────

    # Updates rows in place, matched by skill identity, so assessor overrides
    # (which hang off the portfolio skill row) survive a regeneration.
    def save_ratings(portfolio, ratings)
      existing = portfolio.portfolio_skills.to_a.index_by(&:identity_key)
      keep_ids = []

      ratings.each do |attrs|
        key = PortfolioSkill.identity_key(skill_id: attrs[:skill_id], skill_label: attrs[:skill_label])
        record = existing[key] || portfolio.portfolio_skills.build
        record.assign_attributes(attrs)
        record.save!
        keep_ids << record.id
      end

      portfolio.portfolio_skills.where.not(id: keep_ids).destroy_all
    end

    # ── Model call ────────────────────────────────────────────────────────────

    def request_model_ratings(assessable, coverage, turns)
      response = gemini_client.generate_content(build_prompt(assessable, coverage, turns), temperature: 0.2)

      unless response.is_a?(Hash)
        raise InvalidResponseError, 'Model response was not valid JSON'
      end

      response
    end

    def build_prompt(skills, coverage, turns)
      skills_text = skills.map { |s| skill_definition_block(s) }.join("\n\n")

      coverage_json = {
        skills:     coverage.reject(&:is_discovered).map { |m| coverage_json(m) },
        discovered: coverage.select(&:is_discovered).map { |m| coverage_json(m) }
      }.to_json

      transcript_text = turns.map { |t| "[#{t.speaker.upcase}]: #{t.text}" }.join("\n")

      <<~PROMPT
        You are evaluating a completed skills assessment interview to produce a structured skill portfolio.

        ROLE BEING ASSESSED: #{@session.assessment.name}

        SKILLS TO RATE (only these; skills the interview never reached are rated elsewhere):
        #{skills_text.presence || '(none)'}

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

        For EACH skill listed above, and each discovered skill:

        1. FIND THE EVIDENCE
           Identify the 2-3 most revealing quotes from the CANDIDATE (never the AI).
           Copy each quote WORD FOR WORD from the transcript. Do not paraphrase, fix grammar or translate.
           Quotes that cannot be found verbatim in the candidate's turns are discarded.

        2. ASSIGN A LEVEL
           Compare the candidate's actual behavior to the L1-L5 anchors.
           Assign the highest level where you see CONSISTENT evidence, not just one strong moment.
           If evidence is mixed (mostly L2 with one L3 moment), assign L2.
           If the transcript does not contain enough evidence to rate the skill, set "level" to null.
           Never guess a level.

        3. WRITE THE COMPETENCY SUMMARY
           2-3 sentences. Focus on patterns, not individual answers.
           What does this person reliably do at this skill? What's the ceiling? What's missing?

        OUTPUT (JSON only, no prose):
        {
          "configured_skills": [
            {
              "skill_id": "sk-eng-001",
              "skill_label": "React / Frontend Development",
              "level": 3,
              "evidence": ["verbatim quote 1", "verbatim quote 2"],
              "competency_summary": "2-3 sentence summary"
            }
          ],
          "discovered_skills": [
            {
              "skill_label": "Micro-frontend Architecture",
              "level": 2,
              "evidence": ["verbatim quote 1"],
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
      lines << "WHAT DOES NOT COUNT: #{skill.scope_exclude}" if skill.scope_exclude.present?
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
        probe_count: map.probe_count
      }
    end

    # Error text is stored on the portfolio and shown to assessors, so it must
    # never echo model output (which can contain transcript text).
    def safe_error_message(error)
      case error
      when InvalidResponseError, Gemini::HttpClient::ApiError
        error.message.truncate(200)
      else
        error.class.name
      end
    end
  end
end
