require "rails_helper"

RSpec.describe "Assessments API", type: :request do
  let!(:organization) { Organization.find(1) }
  let(:token) do
    JsonWebToken.encode(
      user_id: 1,
      role: "assessor",
      scheme: organization.scheme
    )
  end

  let(:headers) do
    {
      "Authorization" => "Bearer #{token}",
      "X-Tenant-Scheme" => organization.scheme
    }
  end

  before do
    Current.organization = organization
    Current.tenant_id = organization.id
  end

  describe "DELETE /api/v1/assessments/:id" do
    it "rejects deletion when the assessment has candidates" do
      assessment = Assessment.create!(
        name: "Test Assessment",
        time_limit_min: 30,
        language: "en",
        created_by: 1
      )

      Session.create!(
        assessment: assessment,
        candidate_name: "Test Candidate",
        status: "pending"
      )

      delete "/api/v1/assessments/#{assessment.id}", headers: headers

      expect(response).to have_http_status(:unprocessable_entity)
      expect(JSON.parse(response.body)["errors"][0]["message"]).to eq(
        "Assessment cannot be deleted because it has candidates"
      )
      expect(Assessment.find_by(id: assessment.id)).to be_present
    end

    it "deletes an assessment when it has no candidates" do
      assessment = Assessment.create!(
        name: "Test Assessment",
        time_limit_min: 30,
        language: "en",
        created_by: 1
      )

      delete "/api/v1/assessments/#{assessment.id}", headers: headers

      expect(response).to have_http_status(:ok)
      expect(JSON.parse(response.body)["message"]).to eq(
        "Assessment deleted"
      )
      expect(Assessment.find_by(id: assessment.id)).to be_nil
    end
  end
end