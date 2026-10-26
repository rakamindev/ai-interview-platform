# frozen_string_literal: true

require "rails_helper"

RSpec.describe Assessment, type: :model do
  let(:tenant_id) { 1 }

  before do
    Current.tenant_id = tenant_id
  end

  it "requires a supported time limit" do
    assessment = described_class.new(
      tenant_id: tenant_id,
      created_by: 1,
      name: "Backend interview",
      time_limit_min: 15
    )

    expect(assessment).not_to be_valid
    expect(assessment.errors[:time_limit_min]).to include("is not included in the list")
  end

  it "destroys its sessions when deleted" do
    assessment = described_class.create!(
      tenant_id: tenant_id,
      created_by: 1,
      name: "Backend interview",
      time_limit_min: 30
    )
    session = assessment.sessions.create!(
      tenant_id: tenant_id,
      candidate_name: "Test Candidate",
      status: "pending"
    )

    expect { assessment.destroy! }.to change(Session, :count).by(-1)
    expect { session.reload }.to raise_error(ActiveRecord::RecordNotFound)
  end
end
