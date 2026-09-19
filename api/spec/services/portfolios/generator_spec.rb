# frozen_string_literal: true

require "rails_helper"

RSpec.describe Portfolios::Generator, type: :service do
  let(:session) { create(:session) }

  def gemini_payload
    portfolio_payload(
      configured: [
        skill_payload(
          skill_id: "sk-001",
          label: "Ruby on Rails",
          level: 3,
          evidence: ["quote a", "quote b"],
          summary: "Ships features end to end."
        )
      ],
      discovered: [
        skill_payload(
          skill_id: nil,
          label: "GraphQL",
          level: 2,
          confidence: "low",
          evidence: ["mentioned migrations"],
          summary: "Familiar with schemas."
        )
      ]
    )
  end

  describe "#call" do
    it "creates a pending portfolio when none exists" do
      expect(session.portfolio).to be_nil

      generator = described_class.new(session: session, gemini_client: fake_gemini_client(gemini_payload))
      generator.call

      expect(session.reload.portfolio).to be_present
      expect(session.portfolio.generation_status).to eq("complete")
    end

    it "populates configured and discovered skills" do
      portfolio = create(:portfolio, session: session, generation_status: "pending")

      described_class.new(session: session, gemini_client: fake_gemini_client(gemini_payload)).call

      skills = portfolio.reload.portfolio_skills
      configured = skills.find { |s| s.is_discovered == false }
      discovered = skills.find { |s| s.is_discovered == true }

      expect(configured.skill_id).to eq("sk-001")
      expect(configured.ai_level).to eq(3)
      expect(configured.ai_confidence).to eq("high")
      expect(configured.evidence).to eq(["quote a", "quote b"])
      expect(discovered.skill_label).to eq("GraphQL")
      expect(discovered.skill_id).to be_nil
    end

    it "accepts a parsed Hash response (not just JSON string)" do
      create(:portfolio, session: session, generation_status: "pending")

      described_class.new(session: session, gemini_client: fake_gemini_client(gemini_payload)).call

      expect(session.reload.portfolio.portfolio_skills.count).to eq(2)
    end

    it "is idempotent: a second call does not re-query gemini when complete" do
      create(:portfolio, session: session, generation_status: "complete")

      client = fake_gemini_client(gemini_payload)
      generator = described_class.new(session: session, gemini_client: client)

      generator.call
      generator.call

      expect(client.calls).to eq(0)
    end

    it "skips generation while another worker is already generating" do
      create(:portfolio, session: session, generation_status: "generating")

      client = fake_gemini_client(gemini_payload)
      described_class.new(session: session, gemini_client: client).call

      expect(client.calls).to eq(0)
    end

    it "atomically claims a generated portfolio via update_all (concurrency guard)" do
      portfolio = create(:portfolio, session: session, generation_status: "pending")

      claimed = Portfolio.where(id: portfolio.id, generation_status: %w[pending failed])
                         .update_all(generation_status: "generating")

      expect(claimed).to eq(1)

      # A second concurrent attempt must claim nothing.
      again = Portfolio.where(id: portfolio.id, generation_status: %w[pending failed])
                       .update_all(generation_status: "generating")
      expect(again).to eq(0)
      expect(portfolio.reload.generation_status).to eq("generating")
    end

    it "marks the portfolio failed and rolls back skills when generation raises" do
      portfolio = create(:portfolio, session: session, generation_status: "failed")
      portfolio.portfolio_skills.create!(skill_id: "sk-old", skill_label: "Old Skill", ai_level: 2, ai_confidence: "medium", competency_summary: "Kept after rollback.")

      bad_client = fake_gemini_client(RuntimeError.new("Gemini timeout"))

      expect do
        described_class.new(session: session, gemini_client: bad_client).call
      end.to raise_error(RuntimeError, "Gemini timeout")

      portfolio.reload
      expect(portfolio.generation_status).to eq("failed")
      expect(portfolio.generation_error).to include("Gemini timeout")
      # Existing skills survive rollback because save_skills runs inside a transaction.
      expect(portfolio.portfolio_skills.pluck(:skill_label)).to eq(["Old Skill"])
    end

    it "rejects output that fails validation inside the transaction" do
      portfolio = create(:portfolio, session: session, generation_status: "pending")

      invalid_payload = {
        "configured_skills" => [{ "skill_id" => "sk-x", "skill_label" => "", "level" => nil, "confidence" => "high", "evidence" => [], "competency_summary" => "" }],
        "discovered_skills" => []
      }

      expect do
        described_class.new(session: session, gemini_client: fake_gemini_client(invalid_payload)).call
      end.to raise_error(ActiveRecord::RecordInvalid)

      portfolio.reload
      expect(portfolio.generation_status).to eq("failed")
    end
  end
end