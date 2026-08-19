# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Sessions::Creator do
  it "stamps the assessment's current version at creation time" do
    assessment = create(:assessment)

    session = described_class.new(assessment: assessment, tenant_id: assessment.tenant_id).call

    expect(session).to be_persisted
    expect(session.assessment_version_id).to eq(assessment.assessment_versions.order(created_at: :desc).first.id)
  end
end
