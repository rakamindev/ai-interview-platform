# frozen_string_literal: true

# Shared fake Gemini client doubles for service specs.
module GeminiHelpers
  def fake_gemini_client(response = nil, calls: 0)
    calls = 0 unless calls.is_a?(Integer)
    client = double("Gemini::HttpClient")
    allow(client).to receive(:generate_content) do
      calls += 1
      if response.is_a?(Proc)
        response.call(calls)
      elsif response.is_a?(Exception)
        raise response
      else
        response || {}.to_json
      end
    end
    client.define_singleton_method(:calls) { calls }
    client
  end

  # A JSON payload for portfolio generation (matches the prompt's expected shape).
  def portfolio_payload(configured: [], discovered: [])
    {
      "configured_skills" => configured,
      "discovered_skills" => discovered
    }
  end

  def skill_payload(skill_id:, label:, level:, confidence: "high", evidence: ["quote 1"], summary: "Summary")
    {
      "skill_id" => skill_id,
      "skill_label" => label,
      "level" => level,
      "confidence" => confidence,
      "evidence" => evidence,
      "competency_summary" => summary
    }
  end
end