# frozen_string_literal: true

require "rails_helper"

RSpec.describe AssessmentMailer, type: :mailer do
  let(:org)        { create(:organization, scheme: "test-corp") }
  let(:user)       { create(:user, email: "assessor@test-corp.local") }
  let(:assessment) do
    Assessment.create!(
      name: "Test Assessment",
      time_limit_min: 45,
      language: "en",
      created_by: user.id,
      tenant_id: org.id
    )
  end
  let(:session) { create(:session, assessment: assessment, tenant_id: org.id) }

  describe "#session_completed" do
    let(:mail) { described_class.session_completed(assessment, session) }

    it "sends to assessment creator" do
      expect(mail.to).to eq(["assessor@test-corp.local"])
    end

    it "includes assessment name in subject" do
      expect(mail.subject).to include(assessment.name)
    end

    it "includes candidate name in subject" do
      expect(mail.subject).to include(session.candidate_name)
    end

    it "renders the session completed template" do
      expect(mail.body.encoded).to include("Session Completed")
    end

    it "includes candidate name in body" do
      expect(mail.body.encoded).to include(session.candidate_name)
    end
  end

  describe "#generation_failed" do
    let(:error) { "Gemini API timeout after 30s" }
    let(:mail)  { described_class.generation_failed(assessment, session, error) }

    it "sends to assessment creator" do
      expect(mail.to).to eq(["assessor@test-corp.local"])
    end

    it "includes assessment name in subject" do
      expect(mail.subject).to include(assessment.name)
    end

    it "includes 'failed' in subject" do
      expect(mail.subject).to include("failed")
    end

    it "renders the generation failed template" do
      expect(mail.body.encoded).to include("Generation Failed")
    end

    it "includes error message in body" do
      expect(mail.body.encoded).to include("Gemini API timeout after 30s")
    end
  end
end
