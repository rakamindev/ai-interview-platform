# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Assessments", type: :request do
  let(:org) { create(:organization, scheme: "test-corp") }
  let(:user) { create(:user, email: "assessor@test-corp.local", role: "assessor", organization: org) }
  let(:headers) { jwt_for(user: user, scheme: org.scheme) }
  let(:assessment) { create(:assessment, tenant_id: org.id) }

  describe "GET /api/v1/assessments" do
    before do
      with_tenant(org) do
        3.times do |i|
          a = create(:assessment, tenant_id: org.id, created_at: i.days.ago)
          create(:session, assessment: a, tenant_id: org.id, created_at: i.hours.ago)
          create(:session, assessment: a, tenant_id: org.id, created_at: i.hours.ago + 30.minutes)
        end
      end
    end

    it "returns assessments with latest_session data" do
      get "/api/v1/assessments", headers: headers

      expect(response).to have_http_status(:ok)
      body = response.parsed_body
      expect(body["assessments"]).to be_an(Array)
      expect(body["assessments"].first).to have_key("latest_session")
    end

    it "runs a bounded number of queries regardless of session count" do
      with_tenant(org) do
        assessment = create(:assessment, tenant_id: org.id)
        20.times do |i|
          create(:session, assessment: assessment, tenant_id: org.id, created_at: i.hours.ago)
        end
      end

      queries = []
      callback = ->(*_args, payload) { queries << payload[:sql] }
      ActiveSupport::Notifications.subscribed(callback, "sql.active_record") do
        get "/api/v1/assessments", headers: headers
      end

      real_queries = queries.grep_v(/SCHEMA|BEGIN|COMMIT|SAVEPOINT/)
      expect(real_queries.length).to be <= 3
    end
  end

  describe "DELETE /api/v1/assessments/:id" do
    context "when assessment has dependent sessions" do
      it "returns 422 with the model error" do
        create(:session, assessment: assessment, tenant_id: org.id)

        delete "/api/v1/assessments/#{assessment.id}", headers: headers

        expect(response).to have_http_status(:unprocessable_entity)
        body = response.parsed_body
        expect(body["error"]).to be_present
        expect(body["error"]).to match(/session/i)
      end
    end

    context "when assessment has no dependent sessions" do
      it "returns success" do
        delete "/api/v1/assessments/#{assessment.id}", headers: headers

        expect(response).to have_http_status(:ok)
        expect(Assessment.find_by(id: assessment.id)).to be_nil
      end
    end
  end
end
