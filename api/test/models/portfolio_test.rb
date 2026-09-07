require "test_helper"

class PortfolioTest < ActiveSupport::TestCase
  def setup
    @organization = Organization.find_or_create_by!(
      name: "Test Corp",
      scheme: "test-corp",
      identifier: "test-corp",
      host: "localhost"
    )
    @assessment = Assessment.find_or_create_by!(
      name: "Backend Test Assessment"
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

  test "portfolio supports pending generation status and predicate" do
    portfolio = Portfolio.create!(
      session: @session,
      generation_status: "pending"
    )
    assert_equal "pending", portfolio.generation_status
    assert portfolio.pending?
    assert_not portfolio.complete?
    assert_not portfolio.failed?

    portfolio.update!(generation_status: "generating")
    assert portfolio.generating?

    portfolio.update!(generation_status: "complete")
    assert portfolio.complete?
  end

  test "portfolio skill validates ai_level between 1 and 5" do
    portfolio = Portfolio.create!(
      session: @session,
      generation_status: "complete"
    )

    skill = portfolio.portfolio_skills.build(
      skill_label: "Ruby on Rails",
      ai_level: 3,
      ai_confidence: "high",
      competency_summary: "Demonstrates strong understanding of MVC."
    )
    assert skill.valid?

    assert_raises(ActiveRecord::RecordInvalid, ActiveRecord::StatementInvalid) do
      portfolio.portfolio_skills.create!(
        skill_label: "Invalid Level Skill",
        ai_level: 99,
        ai_confidence: "high",
        competency_summary: "Invalid level"
      )
    end
  end

  test "assessor override requires assessor_notes for audit trail compliance" do
    portfolio = Portfolio.create!(
      session: @session,
      generation_status: "complete"
    )
    skill = portfolio.portfolio_skills.create!(
      skill_label: "System Design",
      ai_level: 2,
      ai_confidence: "medium",
      competency_summary: "Architectural overview"
    )
    override = skill.build_assessor_override(
      ai_level: 2,
      override_level: 3,
      overridden_by: 1,
      assessor_notes: ""
    )
    assert_not override.valid?
    assert_includes override.errors[:assessor_notes], "can't be blank"

    override.assessor_notes = "Candidate demonstrated advanced scaling knowledge during live follow-up."
    assert override.valid?
  end
end
