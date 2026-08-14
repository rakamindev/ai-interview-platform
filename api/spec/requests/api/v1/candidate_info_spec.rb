# frozen_string_literal: true

require "rails_helper"

RSpec.describe "GET /api/v1/sessions/:token/candidate", type: :request do
  it "includes the candidate's name so the interview UI can greet them" do
    organization = create(:organization)
    assessment = create(:assessment, organization: organization)
    session = create(:session, assessment: assessment, candidate_name: "Ahmad Rizky")

    get "/api/v1/sessions/#{session.invite_token}/candidate"

    expect(response).to have_http_status(:ok)
    body = JSON.parse(response.body)
    expect(body["candidate_name"]).to eq("Ahmad Rizky")
  end

  it "returns null candidate_name when none was set, rather than omitting the key" do
    organization = create(:organization)
    assessment = create(:assessment, organization: organization)
    session = create(:session, assessment: assessment, candidate_name: nil)

    get "/api/v1/sessions/#{session.invite_token}/candidate"

    body = JSON.parse(response.body)
    expect(body).to have_key("candidate_name")
    expect(body["candidate_name"]).to be_nil
  end
end
