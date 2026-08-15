# frozen_string_literal: true

module Gemini
  # Drop-in replacement for Gemini::HttpClient that never touches the network.
  #
  # Two jobs:
  #   1. Local dev and demo without a GEMINI_API_KEY — it reads the real prompt
  #      and answers in the shape the prompt asks for, so the product genuinely
  #      works end to end offline.
  #   2. Deterministic hostile input for the test suite. Every `mode` below is a
  #      real failure this code must survive; they are the acceptance criteria,
  #      expressed as data.
  #
  # Interface parity with HttpClient is deliberate: same method, same signature,
  # same return contract (parsed Hash, or a raw String when the model emits
  # something that is not JSON).
  class StubClient
    MODES = %i[
      happy missing_level null_level string_level out_of_range
      evidence_as_object invalid_confidence duplicate_skills unknown_skill
      malformed_json empty_response no_skills timeout rate_limited
    ].freeze

    class UnknownMode < ArgumentError; end

    attr_reader :mode, :model

    def initialize(model: 'stub-model', timeout: 60, mode: :happy, payload: nil)
      @model   = model
      @timeout = timeout
      @mode    = mode.to_sym
      @payload = payload

      raise UnknownMode, "unknown stub mode #{@mode}" unless MODES.include?(@mode)
    end

    def generate_content(prompt, temperature: 0.2)
      _ = temperature

      raise HttpClient::TimeoutError, "Gemini API timeout after #{@timeout}s: stubbed" if mode == :timeout
      raise HttpClient::RateLimitError.new('Rate limited', status: 429) if mode == :rate_limited

      return @payload if @payload
      return 'Sure! Here is the JSON you asked for: {oops' if mode == :malformed_json
      return {} if mode == :empty_response

      case prompt_kind(prompt)
      when :portfolio then portfolio_response(prompt)
      when :coverage  then coverage_response(prompt)
      when :narrative then narrative_response
      else {}
      end
    end

    private

    # ── Prompt routing ────────────────────────────────────────────────────────
    # Matched on the distinctive opening line each service builds, so the stub
    # stays correct if the body of a prompt is edited.
    def prompt_kind(prompt)
      case prompt
      when /structured skill portfolio/i               then :portfolio
      when /analyzing a transcript excerpt/i           then :coverage
      when /fit\/gap analysis narrative/i              then :narrative
      end
    end

    # ── Portfolio (N10) ───────────────────────────────────────────────────────
    def portfolio_response(prompt)
      map = extract_coverage_map(prompt)
      return { 'configured_skills' => [], 'discovered_skills' => [] } if mode == :no_skills

      configured = Array(map['skills']).map { |s| portfolio_skill(s, discovered: false) }
      discovered = Array(map['discovered']).map { |s| portfolio_skill(s, discovered: true) }

      configured += [configured.last].compact if mode == :duplicate_skills
      configured += [portfolio_skill({ 'label' => 'Skill Never Configured' }, discovered: false)] if mode == :unknown_skill

      { 'configured_skills' => configured, 'discovered_skills' => discovered }
    end

    def portfolio_skill(entry, discovered:)
      label = entry['label'] || 'Unlabelled Skill'
      state = entry['state'] || 'covered'
      probes = entry['probe_count'].to_i

      skill = {
        'skill_label'        => label,
        'level'              => level_for(state, probes),
        'confidence'         => confidence_for(state, probes),
        'evidence'           => evidence_for(label, state),
        'competency_summary' => summary_for(label, state)
      }
      skill['skill_id'] = entry['id'] unless discovered

      apply_hostile_mode(skill)
    end

    # The defect this whole exercise turns on: a model asked to rate every skill
    # in the coverage map will happily rate one it has no evidence for. The stub
    # reproduces that honestly — it returns null, and the *application* is
    # responsible for refusing to invent a number from it.
    def level_for(state, probes)
      return nil if state == 'not_yet' || probes.zero?

      case state
      when 'initiated' then 2
      when 'partial'   then 2
      else 3
      end
    end

    def confidence_for(state, probes)
      return 'low' if probes <= 1 || state == 'initiated'
      return 'high' if probes >= 3 && state == 'covered'

      'medium'
    end

    def evidence_for(label, state)
      return [] if state == 'not_yet'

      [
        "When we hit contention on #{label.downcase}, I measured before changing anything.",
        'I would not repeat that rollout without a kill switch.'
      ]
    end

    def summary_for(label, state)
      return "No evidence gathered for #{label} during this session." if state == 'not_yet'

      "Applies #{label} independently on routine scope and reasons about tradeoffs " \
        'when pushed, though systemic ownership was not demonstrated.'
    end

    def apply_hostile_mode(skill)
      case mode
      when :missing_level      then skill.delete('level')
      when :null_level         then skill['level'] = nil
      when :string_level       then skill['level'] = "L#{skill['level'] || 3}"
      when :out_of_range       then skill['level'] = [0, 9, -2].sample
      when :evidence_as_object then skill['evidence'] = { 'quote_1' => 'Structured wrong on purpose.' }
      when :invalid_confidence then skill['confidence'] = 'very high'
      end
      skill
    end

    # ── Coverage (N7) ─────────────────────────────────────────────────────────
    def coverage_response(prompt)
      map = extract_coverage_map(prompt)

      updates = Array(map['skills']).reject { |s| s['state'] == 'covered' }.map do |s|
        {
          'id'              => s['id'],
          'new_state'       => next_state(s['state']),
          'new_probe_count' => s['probe_count'].to_i + 1,
          'reason'          => 'Candidate gave a concrete, first-hand example.'
        }
      end

      { 'skill_updates' => updates, 'discovered_skills' => [] }
    end

    def next_state(state)
      { 'not_yet' => 'initiated', 'initiated' => 'partial', 'partial' => 'covered' }.fetch(state, 'initiated')
    end

    # ── Narrative (N13) ───────────────────────────────────────────────────────
    def narrative_response
      {
        'culture_narrative' => 'Explains decisions in terms of constraints rather than preferences, ' \
                               'and volunteers what went wrong without prompting.',
        'overall_narrative' => 'Meets the bar on the assessed competencies. One requirement was not ' \
                               'exercised in this session and should be covered before a decision.'
      }
    end

    # ── Prompt parsing ────────────────────────────────────────────────────────
    # Both prompts embed the coverage map as a single JSON line. Reading it back
    # is what lets the stub answer about the *actual* session rather than a fixed
    # fixture, which is what makes the offline demo believable.
    def extract_coverage_map(prompt)
      json = prompt[/^\s*(\{"skills":.*\})\s*$/, 1]
      return { 'skills' => [], 'discovered' => [] } unless json

      JSON.parse(json)
    rescue JSON::ParserError
      { 'skills' => [], 'discovered' => [] }
    end
  end
end
