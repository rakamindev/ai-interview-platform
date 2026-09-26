# frozen_string_literal: true

require "rails_helper"

# Vacancies and assessments are the two tenant-owned aggregates assessors edit
# directly, so cross-tenant access and bad input are checked for both.
RSpec.describe "Tenant-owned resources", type: :request do
  let(:own_org) { create(:organization) }
  let(:other_org) { create(:organization) }
  let(:headers) { auth_headers(organization: own_org) }

  {
    "vacancies"   => :vacancy,
    "assessments" => :assessment
  }.each do |path, factory|
    describe "/api/v1/#{path}" do
      let!(:own) { create(factory, organization: own_org) }
      let!(:foreign) { create(factory, organization: other_org) }

      it "lists only the caller's tenant records" do
        get "/api/v1/#{path}", headers: headers

        ids = JSON.parse(response.body)[path].map { |r| r["id"] }
        expect(ids).to eq([own.id])
      end

      it "returns 404 when reading another tenant's record" do
        get "/api/v1/#{path}/#{foreign.id}", headers: headers

        expect(response).to have_http_status(:not_found)
      end

      it "returns 404 and leaves the record intact when deleting another tenant's record" do
        delete "/api/v1/#{path}/#{foreign.id}", headers: headers

        expect(response).to have_http_status(:not_found)
        expect(foreign.class.unscoped.exists?(foreign.id)).to be(true)
      end

      it "returns 4xx, not 500, when the request body is missing" do
        post "/api/v1/#{path}", headers: headers

        expect(response.status).to be_between(400, 422)
      end
    end
  end

  it "rejects a vacancy with a blank title" do
    post "/api/v1/vacancies", params: { vacancy: { role_title: "" } }, headers: headers

    expect(response).to have_http_status(:unprocessable_entity)
  end
end
