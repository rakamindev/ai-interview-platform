# frozen_string_literal: true

require "spec_helper"

RSpec.describe Api::V1::AssessmentsController, type: :controller do
  let!(:organization) do
    Organization.create!(
      name: "Assessment Spec Org",
      scheme: "assessment-spec-#{SecureRandom.hex(6)}",
      identifier: "assessment-spec-#{SecureRandom.hex(6)}",
      host: "assessment-spec-#{SecureRandom.hex(6)}.example.test"
    )
  end

  around do |example|
    previous_store = RequestStore.store.dup

    Current.organization = organization
    Current.tenant_id = organization.id

    example.run
  ensure
    RequestStore.store.replace(previous_store)
  end

  before do
    # Authentication is tested elsewhere; these examples focus on DELETE behavior.
    allow(controller).to receive(:require_tenant!)
    allow(controller).to receive(:authenticate_with_roles!)
  end

  let!(:assessment) do
    Assessment.create!(
      name: "Delete test assessment",
      time_limit_min: 10,
      created_by: 1
    )
  end

  describe "DELETE #destroy" do
    it "deletes an assessment that has no sessions" do
      expect do
        delete :destroy, params: { id: assessment.id }
      end.to change { Assessment.unscoped.exists?(assessment.id) }.from(true).to(false)

      expect(response).to have_http_status(:ok)
      expect(JSON.parse(response.body)["message"]).to eq("Assessment deleted")
    end

    it "does not report success when sessions restrict deletion" do
      Session.create!(
        assessment: assessment,
        tenant_id: organization.id,
        status: "pending"
      )

      expect do
        delete :destroy, params: { id: assessment.id }
      end.not_to change { Assessment.unscoped.exists?(assessment.id) }

      body = JSON.parse(response.body)

      expect(response).to have_http_status(:conflict)
      expect(body.dig("errors", 0, "message")).to include(
        "associated sessions"
      )
    end
  end
end
