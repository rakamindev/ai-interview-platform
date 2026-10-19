# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Portfolios::Generator, type: :service do
  let(:org) { create_organization }
  let(:user) { create_user(org) }
  let(:assessment) do
    Assessment.create!(
      tenant_id: org.id,
      name: "Backend Architect Assessment",
      time_limit_min: 45,
      created_by: user.id
    )
  end
  let(:session) do
    Session.create!(
      tenant_id: org.id,
      assessment: assessment,
      status: 'ended'
    )
  end
  let!(:portfolio) do
    Portfolio.create!(
      session: session,
      generation_status: 'pending'
    )
  end

  let(:mock_gemini) { instance_double(Gemini::HttpClient) }

  let(:ai_initial_response) do
    {
      "configured_skills" => [
        {
          "skill_id" => "sk-backend",
          "skill_label" => "Distributed Systems",
          "level" => 2,
          "confidence" => "medium",
          "evidence" => ["Quote on redis queues"],
          "competency_summary" => "Understands queue architecture."
        }
      ],
      "discovered_skills" => [
        {
          "skill_label" => "Kubernetes",
          "level" => 3,
          "confidence" => "high",
          "evidence" => ["Quote on pod scheduling"],
          "competency_summary" => "Strong container orchestration skills."
        }
      ]
    }.to_json
  end

  let(:ai_regenerated_response) do
    {
      "configured_skills" => [
        {
          "skill_id" => "sk-backend",
          "skill_label" => "Distributed Systems",
          "level" => 3,
          "confidence" => "high",
          "evidence" => ["Updated quote on consensus algorithm", "Quote on redis queues"],
          "competency_summary" => "Demonstrated raft consensus comprehension."
        }
      ],
      "discovered_skills" => [
        {
          "skill_label" => "Kubernetes",
          "level" => 3,
          "confidence" => "high",
          "evidence" => ["Quote on pod scheduling"],
          "competency_summary" => "Strong container orchestration skills."
        }
      ]
    }.to_json
  end

  describe "#call" do
    it "saves configured and discovered skills from AI response" do
      allow(mock_gemini).to receive(:generate_content).and_return(ai_initial_response)

      described_class.new(session: session, gemini_client: mock_gemini).call

      portfolio.reload
      expect(portfolio.generation_status).to eq('complete')
      expect(portfolio.portfolio_skills.count).to eq(2)

      backend_skill = portfolio.portfolio_skills.find_by(skill_id: "sk-backend")
      expect(backend_skill.ai_level).to eq(2)
      expect(backend_skill.is_discovered).to be(false)
      expect(backend_skill.ai_confidence).to eq('medium')

      k8s_skill = portfolio.portfolio_skills.find_by(skill_label: "Kubernetes")
      expect(k8s_skill.is_discovered).to be(true)
      expect(k8s_skill.ai_level).to eq(3)
    end

    it "CRITICAL REGRESSION TEST: preserves assessor overrides across portfolio regeneration" do
      # Step 1: Initial generation
      allow(mock_gemini).to receive(:generate_content).and_return(ai_initial_response)
      described_class.new(session: session, gemini_client: mock_gemini).call

      portfolio.reload
      backend_skill = portfolio.portfolio_skills.find_by(skill_id: "sk-backend")
      expect(backend_skill).to be_present
      expect(backend_skill.ai_level).to eq(2)

      # Step 2: Assessor manually overrides the skill to Level 4 with detailed evaluation notes
      override = backend_skill.create_assessor_override!(
        ai_level: 2,
        override_level: 4,
        assessor_notes: "Candidate demonstrated deep distributed transaction knowledge during live defense.",
        overridden_by: user.id
      )
      expect(override).to be_persisted

      # Step 3: Portfolio is regenerated (e.g. re-run job or updated model prompt)
      allow(mock_gemini).to receive(:generate_content).and_return(ai_regenerated_response)
      described_class.new(session: session, gemini_client: mock_gemini).call

      # Step 4: Verify the override was NOT destroyed and was properly synchronized
      portfolio.reload
      updated_backend_skill = portfolio.portfolio_skills.find_by(skill_id: "sk-backend")
      expect(updated_backend_skill.ai_level).to eq(3) # new AI level

      persisted_override = updated_backend_skill.assessor_override
      expect(persisted_override).to be_present
      expect(persisted_override.override_level).to eq(4)
      expect(persisted_override.assessor_notes).to eq("Candidate demonstrated deep distributed transaction knowledge during live defense.")
      expect(persisted_override.ai_level).to eq(3) # synced to newly regenerated AI level
      expect(persisted_override.overridden_by).to eq(user.id)
    end
  end
end
