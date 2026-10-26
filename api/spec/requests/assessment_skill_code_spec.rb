# frozen_string_literal: true

require 'rails_helper'

# A skill picked from the catalog must keep its catalog code when the assessment is saved.
RSpec.describe 'Saving a catalog skill with its code' do
  let(:org)     { Organization.create!(name: 'Test Corp', scheme: 'test-corp', identifier: 'test-corp', host: 'test-corp.local') }
  let(:headers) { { 'Authorization' => "Bearer #{JsonWebToken.encode({ user_id: 1, role: 'admin', scheme: org.scheme })}" } }

  it 'stores the catalog code on the assessment skill' do
    post '/api/v1/assessments', headers:, params: {
      assessment: {
        name: 'Backend Engineer', time_limit_min: 30,
        assessment_skills_attributes: [{
          skill_id: 'SK-ENG-002', skill_label: 'Node.js / Backend Development', expected_level: 3, display_order: 0,
          l1_anchor: 'L1', l2_anchor: 'L2', l3_anchor: 'L3', l4_anchor: 'L4', l5_anchor: 'L5'
        }]
      }
    }

    expect(response).to have_http_status(:created)
    expect(AssessmentSkill.last.skill_id).to eq('SK-ENG-002')
  end
end
