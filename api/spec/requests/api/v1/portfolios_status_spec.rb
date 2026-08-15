# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Api::V1::Portfolios#show status field", type: :request do
  let(:organization) { create(:organization) }
  let(:session) { create(:session, assessment: create(:assessment, organization: organization)) }
  let(:portfolio) { create(:portfolio, session: session) }
  let(:headers) { auth_headers(organization: organization) }

  it "exposes status for an assessed, not_assessed, and unparseable skill" do
    create(:portfolio_skill, portfolio: portfolio, skill_label: "React", status: "assessed", ai_level: 3)
    create(:portfolio_skill, :not_assessed, portfolio: portfolio, skill_label: "Communication")
    create(:portfolio_skill, :unparseable, portfolio: portfolio, skill_label: "System Design")

    get "/api/v1/sessions/#{session.id}/portfolio", headers: headers

    expect(response).to have_http_status(:ok)
    skills = JSON.parse(response.body).dig("portfolio", "skills")
    statuses = skills.to_h { |s| [s["skill_label"], s["status"]] }

    expect(statuses).to eq(
      "React" => "assessed",
      "Communication" => "not_assessed",
      "System Design" => "unparseable"
    )
  end
end
