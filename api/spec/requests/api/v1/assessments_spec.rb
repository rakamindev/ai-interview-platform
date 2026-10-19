# frozen_string_literal: true

require 'rails_helper'

RSpec.describe "Api::V1::Assessments", type: :request do
  let(:org) { create_organization }
  let(:user) { create_user(org) }
  let(:headers) { auth_headers(org, user) }

  let(:assessment) do
    Assessment.create!(
      tenant_id: org.id,
      name: "Fullstack Assessment",
      time_limit_min: 45,
      created_by: user.id
    )
  end

  let!(:skill_1) do
    assessment.assessment_skills.create!(
      skill_id: "sk-react",
      skill_label: "React",
      expected_level: 3,
      display_order: 0,
      l1_anchor: "Basic JSX",
      l2_anchor: "Hooks and state",
      l3_anchor: "Performance optimization",
      l4_anchor: "Custom architecture",
      l5_anchor: "Core framework author"
    )
  end
  let!(:skill_2) do
    assessment.assessment_skills.create!(
      skill_id: "sk-node",
      skill_label: "Node.js",
      expected_level: 3,
      display_order: 1,
      l1_anchor: "Basic express",
      l2_anchor: "Async IO",
      l3_anchor: "Event loop internals",
      l4_anchor: "High scale servers",
      l5_anchor: "Runtime core contributor"
    )
  end

  describe "PUT /api/v1/assessments/:id" do
    it "successfully deletes a skill when _destroy: true is sent" do
      expect(assessment.assessment_skills.count).to eq(2)

      put "/api/v1/assessments/#{assessment.id}",
          params: {
            assessment: {
              name: "Fullstack Assessment Updated",
              assessment_skills_attributes: [
                { id: skill_1.id, skill_label: "React", expected_level: 4, display_order: 0 },
                { id: skill_2.id, _destroy: true }
              ]
            }
          }.to_json,
          headers: headers

      expect(response).to have_http_status(:ok)
      assessment.reload
      expect(assessment.assessment_skills.count).to eq(1)
      expect(assessment.assessment_skills.find_by(id: skill_2.id)).to be_nil
      expect(assessment.assessment_skills.first.skill_label).to eq("React")
      expect(assessment.assessment_skills.first.expected_level).to eq(4)
    end
  end
end
