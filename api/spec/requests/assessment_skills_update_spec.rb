# frozen_string_literal: true

require 'rails_helper'

# How PUT /assessments/:id treats the skills list. The web edit form leaves a removed skill out of the list instead
# of sending `_destroy` (P1-14); this pins what the API does with each, so the fix belongs in the web.
RSpec.describe 'Updating an assessment\'s skills', type: :request do
  let(:organization) { create(:organization) }
  let(:assessment)   { create(:assessment, :with_skills, organization:) }
  let(:headers)      { auth_headers_for(organization) }

  let(:react) { assessment.assessment_skills.find_by!(skill_label: 'React') }
  let(:comms) { assessment.assessment_skills.find_by!(skill_label: 'Communication') }

  before { allow(SystemPromptGeneratorWorker).to receive(:perform_async) }

  def update_skills(skills)
    put "/api/v1/assessments/#{assessment.id}",
        params: { assessment: { name: assessment.name, assessment_skills_attributes: skills } }.to_json, headers:
  end

  it 'keeps a skill that is just left out of the list' do
    update_skills([{ id: react.id, skill_label: 'React', display_order: 0 }])

    expect(response).to have_http_status(:ok)
    expect(assessment.assessment_skills.reload.pluck(:skill_label)).to include('Communication')
  end

  it 'deletes a skill sent with _destroy' do
    update_skills([{ id: react.id, display_order: 0 }, { id: comms.id, _destroy: true }])

    expect(response).to have_http_status(:ok)
    expect(assessment.assessment_skills.reload.pluck(:skill_label)).not_to include('Communication')
  end
end
