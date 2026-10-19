# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Session, type: :model do
  let(:org) { create_organization }
  let(:user) { create_user(org) }
  let(:assessment) do
    Assessment.create!(
      tenant_id: org.id,
      name: "Engineering Assessment",
      time_limit_min: 30,
      created_by: user.id
    )
  end

  it "automatically generates a 64-character invite token on create" do
    session = described_class.create!(
      tenant_id: org.id,
      assessment: assessment
    )

    expect(session.invite_token).to be_present
    expect(session.invite_token.length).to eq(64)
    expect(session.status).to eq('pending')
  end

  it "generates an invite_url pointing to the frontend port (5173) instead of API backend (3001)" do
    session = described_class.create!(
      tenant_id: org.id,
      assessment: assessment
    )

    expect(session.invite_url).to start_with("http://localhost:5173/interview/")
    expect(session.invite_url).to include(session.invite_token)
    expect(session.invite_url).not_to include(":3001")
  end
end
