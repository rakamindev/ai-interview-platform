require "test_helper"

class GeneratorTest < ActiveSupport::TestCase
  class FakeGeminiClient
    def generate_content(prompt, temperature: 0.2)
      {
        "configured_skills" => [
          {
            "skill_id" => "sk-test-1",
            "skill_label" => "System Architecture",
            "level" => 4,
            "confidence" => "high",
            "evidence" => ["Quote 1", "Quote 2"],
            "competency_summary" => "Designs resilient multi-tenant architectures."
          }
        ],
        "discovered_skills" => [
          {
            "skill_label" => "Redis Caching",
            "level" => 3,
            "confidence" => "medium",
            "evidence" => ["Used Redis for cache invalidation"],
            "competency_summary" => "Understands key eviction and caching patterns."
          }
        ]
      }
    end
  end

  def setup
    @organization = Organization.find_or_create_by!(
      name: "Test Corp",
      scheme: "test-corp",
      identifier: "test-corp",
      host: "localhost"
    )
    @assessment = Assessment.find_or_create_by!(
      name: "Architecture Assessment"
    ) do |a|
      a.tenant_id = 1
      a.created_by = 1
      a.time_limit_min = 45
    end
    @session = Session.create!(
      tenant_id: 1,
      assessment: @assessment,
      candidate_name: "Test Candidate",
      status: "ended"
    )
  end

  def teardown
    @session&.destroy
  end

  test "generator creates portfolio skills from client response" do
    @session.transcript_turns.create!(
      turn_number: 1,
      speaker: "candidate",
      text: "I designed a scalable system with Redis and PostgreSQL."
    )
    fake_client = FakeGeminiClient.new
    generator = Portfolios::Generator.new(session: @session, gemini_client: fake_client)
    portfolio = generator.call

    assert_equal "complete", portfolio.generation_status
    assert_equal 2, portfolio.portfolio_skills.count

    configured = portfolio.portfolio_skills.find_by(is_discovered: false)
    assert_equal "System Architecture", configured.skill_label
    assert_equal 4, configured.ai_level
    assert_equal "high", configured.ai_confidence
    assert_equal 2, configured.evidence_quotes.length

    discovered = portfolio.portfolio_skills.find_by(is_discovered: true)
    assert_equal "Redis Caching", discovered.skill_label
    assert_equal 3, discovered.ai_level
  end

  test "generator handles 0 turn sessions gracefully" do
    generator = Portfolios::Generator.new(session: @session, gemini_client: FakeGeminiClient.new)
    portfolio = generator.call

    assert portfolio.persisted?
    assert_includes %w[complete failed], portfolio.generation_status
  end
end
