require_relative "../rails_helper"

RSpec.describe "Deleting assessments and candidates", type: :request do
  before do
    @organization = Organization.create!(
      name: "Test organization",
      scheme: "test-corp",
      identifier: "test-corp",
      host: "test-corp",
      alias_hosts: [],
      config: {}
    )

    @assessment = Current.using(tenant_id: @organization.id) do
      Assessment.create!(
        name: "Test assessment",
        time_limit_min: 30,
        created_by: 1
      )
    end
  end

  it "deletes a candidate session and its related interview data" do
    session = Current.using(tenant_id: @organization.id) do
      @assessment.sessions.create!(candidate_name: "Test candidate")
    end
    TranscriptTurn.create!(session:, turn_number: 1, speaker: "candidate", text: "Hello")
    CoverageMap.create!(session:, skill_label: "Communication")
    Portfolio.create!(session:)

    delete "/api/v1/sessions/#{session.id}", headers: auth_headers

    expect(response).to have_http_status(:ok)
    expect(Session.unscoped.exists?(session.id)).to be(false)
    expect(TranscriptTurn.exists?(session_id: session.id)).to be(false)
    expect(CoverageMap.exists?(session_id: session.id)).to be(false)
    expect(Portfolio.exists?(session_id: session.id)).to be(false)
  end

  it "does not delete an active candidate session" do
    session = Current.using(tenant_id: @organization.id) do
      @assessment.sessions.create!(candidate_name: "Active candidate", status: "active")
    end

    delete "/api/v1/sessions/#{session.id}", headers: auth_headers

    expect(response).to have_http_status(:conflict)
    expect(Session.unscoped.exists?(session.id)).to be(true)
  end

  it "deletes an assessment and its candidate sessions" do
    session = Current.using(tenant_id: @organization.id) do
      @assessment.sessions.create!(candidate_name: "Test candidate")
    end

    delete "/api/v1/assessments/#{@assessment.id}", headers: auth_headers

    expect(response).to have_http_status(:ok)
    expect(Assessment.unscoped.exists?(@assessment.id)).to be(false)
    expect(Session.unscoped.exists?(session.id)).to be(false)
  end

  it "does not delete an assessment with an active candidate session" do
    Current.using(tenant_id: @organization.id) do
      @assessment.sessions.create!(candidate_name: "Active candidate", status: "active")
    end

    delete "/api/v1/assessments/#{@assessment.id}", headers: auth_headers

    expect(response).to have_http_status(:conflict)
    expect(Assessment.unscoped.exists?(@assessment.id)).to be(true)
  end

  private

  def auth_headers
    token = JsonWebToken.encode(
      user_id: 1,
      role: "admin",
      scheme: @organization.scheme
    )

    { "Authorization" => "Bearer #{token}" }
  end
end