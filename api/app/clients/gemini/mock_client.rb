# frozen_string_literal: true

module Gemini
  # Deterministic stand-in for the Gemini REST API.
  #
  # Used when GEMINI_MOCK_MODE=true, when the test suite runs, or when no API
  # key is configured outside production/staging. It returns exactly the JSON
  # shape the real service returns, so callers, parsers, validations and every
  # UI state along the pipeline are exercised without the network, credentials
  # or cost.
  #
  # Prompts are recognised by markers that are stable in the prompt templates.
  # If marker detection ever misses, the mock still answers with a
  # syntactically valid, clearly-labelled payload rather than breaking a
  # developer's session or a CI run.
  class MockClient
    PORTFOLIO_MARKER = 'FULL INTERVIEW TRANSCRIPT:'
    NARRATIVE_MARKER = 'culture_narrative'
    ANALYSIS_MARKER  = '--- BEGIN UNTRUSTED TRANSCRIPT ---'

    attr_reader :model, :role

    def initialize(role: nil, model: nil, delay: nil, api_key: nil, timeout: nil, **_ignored)
      @role = role || :custom
      @model = (value_or(model) || (role && Config.by_role(role)[:model]) || Config.model(:flash)) + '-mock'
      @delay = delay.nil? ? ENV.fetch('GEMINI_MOCK_DELAY', 0).to_f : delay.to_f
      @api_key = api_key
      @timeout = timeout
    end

    # Returns a Hash and does not raise for a normal prompt: mock mode must
    # never be the thing that breaks a developer's session or a CI run.
    def generate_content(prompt, temperature: 0.2)
      started = Process.clock_gettime(Process::CLOCK_MONOTONIC)
      sleep(@delay) if @delay.positive?

      payload =
        case prompt
        when /#{Regexp.escape(PORTFOLIO_MARKER)}/ then portfolio_fixture(prompt)
        when /#{Regexp.escape(NARRATIVE_MARKER)}/ then narrative_fixture
        when /#{Regexp.escape(ANALYSIS_MARKER)}/  then analysis_fixture
        else generic_fixture
        end

      Rails.logger.info(
        "[Gemini] role=#{@role} model=#{@model} classification=mock status=200 " \
        "latency_ms=#{((Process.clock_gettime(Process::CLOCK_MONOTONIC) - started) * 1000).round} " \
        "prompt_chars=#{prompt.to_s.length} fixture=#{fixture_identity(payload)}"
      )

      payload
    end

    private

    def value_or(value)
      value.present? ? value : nil
    end

    def fixture_identity(payload)
      return 'portfolio' if payload.key?('configured_skills')
      return 'narrative' if payload.key?('culture_narrative')
      return 'analysis'  if payload.key?('skill_updates')

      'generic'
    end

    # Built from the coverage map embedded in the prompt, so a mock portfolio
    # shows the skills of the assessment actually running in this environment
    # rather than unrelated sample data.
    def portfolio_fixture(prompt)
      skills = coverage_from_prompt(prompt)

      {
        'configured_skills' => skills.reject { |s| s['is_discovered'] }.map { |s| skill_fixture(s, false) },
        'discovered_skills' => skills.select { |s| s['is_discovered'] }.map { |s| skill_fixture(s, true) }
      }
    end

    def skill_fixture(skill, discovered)
      label       = skill['label'].to_s.strip
      state       = skill['state'].to_s
      probe_count = skill['probe_count'].to_i

      level = case state
              when 'covered'  then 3 + [probe_count - 2, 1].min
              when 'partial'  then 3
              when 'initiated' then 2
              else 1
              end

      confidence = if probe_count >= 3 && state == 'covered' then 'high'
                    elsif probe_count >= 2 || state == 'partial' then 'medium'
                    else 'low'
                    end

      {
        'skill_id'           => discovered ? nil : skill['id'],
        'skill_label'        => label,
        'level'              => [[level, 1].max, 5].min,
        'confidence'         => confidence,
        'evidence'           => [
          "(mock) #{label} was discussed during this sample interview â€” set GEMINI_MOCK_MODE=false " \
          'to call the real model.'
        ],
        'competency_summary' => "(mock) Coverage state #{state.presence || 'not_yet'} with #{probe_count} " \
                                'probe(s); ratings are simulated until a live Gemini call is used.'
      }
    end

    def narrative_fixture
      {
        'culture_narrative' => '(mock) The sample candidate works well in collaborative teams and asks ' \
                                'clarifying questions before committing to an approach.',
        'overall_narrative' => '(mock) Mock analysis: a plausible hire for junior-scope work, pending a ' \
                                'live Gemini assessment of the recorded transcript.'
      }
    end

    # Coverage is deliberately left untouched: a mock must not invent
    # interview signal or auto-advance a skill that was never probed.
    def analysis_fixture
      { 'skill_updates' => [], 'discovered_skills' => [] }
    end

    def generic_fixture
      { 'ok' => true, 'mock' => true, 'note' => 'No prompt marker matched; returned a generic mock payload.' }
    end

    # Extracts the JSON block the portfolio prompt embeds between
    # "FINAL COVERAGE MAP:" and the transcript header.
    def coverage_from_prompt(prompt)
      raw = prompt[%r{FINAL COVERAGE MAP:\s*(\{.*?\})\s*\n\s*#{Regexp.escape(PORTFOLIO_MARKER)}}m, 1]
      return [] if raw.blank?

      data = JSON.parse(raw)
      Array(data['skills']) + Array(data['discovered'])
    rescue JSON::ParserError
      []
    end
  end
end