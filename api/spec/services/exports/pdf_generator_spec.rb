# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Exports::PdfGenerator do
  let!(:org) do
    Organization.find_by(scheme: 'test-corp') || Organization.create!(
      name: 'Test Corp', scheme: 'test-corp', identifier: 'test-corp-id', host: 'localhost'
    )
  end
  let!(:user) { User.create!(email: "assessor_pdf@test.com", password_digest: BCrypt::Password.create("secret123"), role: "admin") }
  let!(:assessment) do
    a = Assessment.create!(name: "Site Reliability Engineer", tenant_id: org.id, created_by: user.id, time_limit_min: 30)
    a.assessment_skills.create!(skill_id: "sk-01", skill_label: "Linux Systems", l1_anchor: "L1", l2_anchor: "L2", l3_anchor: "L3", l4_anchor: "L4", l5_anchor: "L5")
    a
  end
  let!(:session) { Session.create!(assessment: assessment, tenant_id: org.id, status: 'ended', duration_seconds: 1200) }
  let!(:portfolio) do
    p = session.create_portfolio!(generation_status: 'complete')
    p.portfolio_skills.create!(
      skill_id: "sk-01",
      skill_label: "Linux Systems",
      ai_level: 4,
      ai_confidence: "high",
      competency_summary: "Deep kernel knowledge.",
      evidence: ["Managed kernel parameters."]
    )
    p
  end
  let!(:vacancy) do
    v = Vacancy.create!(role_title: "Senior SRE", tenant_id: org.id, created_by: user.id)
    v.vacancy_skills.create!(skill_id: "sk-01", skill_label: "Linux Systems", expected_level: 4)
    v
  end

  it "renders a valid binary PDF document string" do
    pdf_data = described_class.new(portfolio: portfolio, vacancy: vacancy).call

    expect(pdf_data).to be_present
    expect(pdf_data.start_with?("%PDF-")).to be true
  end

  it "renders PDF cleanly without a vacancy attached" do
    pdf_data = described_class.new(portfolio: portfolio).call

    expect(pdf_data).to be_present
    expect(pdf_data.start_with?("%PDF-")).to be true
  end

  context "when text falls outside the built-in font's character set" do
    before do
      skill = portfolio.portfolio_skills.first
      skill.update!(
        competency_summary: "Explains trade-offs → picks the safer rollout 🚀",
        evidence: ["Saya pakai cgroup → limit memori 内存"]
      )
      AssessorOverride.create!(portfolio_skill: skill, ai_level: 4, override_level: 3,
                               overridden_by: user.id, assessor_notes: "Kurang dalam → tuning ✅")
      FitGapReport.create!(
        portfolio: portfolio, vacancy: vacancy, generated_at: Time.current,
        skill_comparisons: [{ skill_label: "Linux Systems", expected_level: 4, candidate_level: 3,
                              result: "gap", delta: -1 }],
        overall_narrative: "Strong fit → recommend 👍"
      )
    end

    it "exports an overridden skill and LLM text with arrows, emoji and CJK instead of raising" do
      pdf_data = described_class.new(portfolio: portfolio.reload, vacancy: vacancy).call

      expect(pdf_data.start_with?("%PDF-")).to be true
    end
  end
end
