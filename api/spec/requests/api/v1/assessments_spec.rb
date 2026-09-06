require 'rails_helper'

RSpec.describe "Api::V1::Assessments", type: :request do
  let(:org) { Organization.create!(name: 'Test Org', identifier: 'test-org', scheme: 'test-org', host: 'test-org.local') }
  let(:user) { User.create!(email: 'assessor@example.com', password: 'password', role: 'admin') }
  let(:token) do
    JsonWebToken.encode({ user_id: user.id, scheme: org.scheme, role: user.role, exp: 1.day.from_now.to_i })
  end
  let(:headers) { { "Authorization" => "Bearer #{token}", "X-Organization-Scheme" => org.scheme } }

  describe "POST /api/v1/assessments" do
    it "debugs" do
      post "/api/v1/assessments", params: {
        assessment: {
          name: "Test Assessment",
          time_limit_min: 45,
          language: "en",
          assessment_skills_attributes: [
            {
              skill_label: "Ruby",
              is_custom: true,
              expected_level: 3,
              display_order: 0,
              l1_anchor: "A", l2_anchor: "B", l3_anchor: "C", l4_anchor: "D", l5_anchor: "E"
            }
          ]
        }
      }, headers: headers
      puts "DEBUG STATUS: #{response.status}"
      puts "DEBUG BODY: #{response.body}"
    end
    let(:valid_attributes) do
      {
        assessment: {
          name: "Test Assessment",
          time_limit_min: 45,
          language: "en",
          assessment_skills_attributes: [
            {
              skill_label: "Ruby",
              is_custom: true,
              expected_level: 3,
              display_order: 0,
              l1_anchor: "A", l2_anchor: "B", l3_anchor: "C", l4_anchor: "D", l5_anchor: "E"
            }
          ]
        }
      }
    end

    it "creates an assessment and enqueues prompt generation" do
      expect(SystemPromptGeneratorWorker).to receive(:perform_async).and_return(true)

      expect {
        post "/api/v1/assessments", params: valid_attributes, headers: headers
      }.to change(Assessment, :count).by(1)

      puts response.body if response.status != 201
      expect(response).to have_http_status(:created)
      json = JSON.parse(response.body)
      expect(json["assessment"]["prompt_generation_status"]).to eq("pending")
    end

    it "rescues enqueue errors and marks prompt generation as failed" do
      expect(SystemPromptGeneratorWorker).to receive(:perform_async).and_raise(StandardError.new("Redis down"))

      expect {
        post "/api/v1/assessments", params: valid_attributes, headers: headers
      }.to change(Assessment, :count).by(1)

      puts response.body if response.status != 201
      expect(response).to have_http_status(:created)
      assessment = Assessment.last
      expect(assessment.prompt_generation_status).to eq("failed")
      expect(assessment.prompt_generation_error).to include("Background job failed to queue: Redis down")
    end
  end
end
