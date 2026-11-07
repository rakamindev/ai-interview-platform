# frozen_string_literal: true

require 'rails_helper'

# W27: the API accepted an assessment that lists the same skill twice; every interview for it then
# failed at start (unique index on coverage_maps). Reproduction: assessment/evidence/w27-repro.txt.
# Expected: the duplicate is rejected when the assessment is saved, where the assessor can fix it.
RSpec.describe 'Duplicate skills in an assessment (W27)', type: :request do
  let(:org) { create_org }
  let(:headers) { auth_headers(org) }
  let(:anchors) { { l1_anchor: 'a1', l2_anchor: 'a2', l3_anchor: 'a3', l4_anchor: 'a4', l5_anchor: 'a5' } }

  def skills(*labels) = labels.each_with_index.map { |l, i| anchors.merge(skill_label: l, display_order: i) }

  def create_with(*labels)
    post '/api/v1/assessments', headers: headers,
                                params: { assessment: { name: 'Frontend', time_limit_min: 30, assessment_skills_attributes: skills(*labels) } }
  end

  def error_message = JSON.parse(response.body).dig('errors', 0, 'message')

  describe 'creating' do
    it 'rejects an exact duplicate with a message naming the skill' do
      expect { create_with('React', 'React') }.not_to change(Assessment.unscoped, :count)
      expect(response).to have_http_status(:unprocessable_entity)
      expect(error_message).to eq('Skill "React" is listed more than once. Remove the duplicate before saving.')
    end

    it 'treats case-only and whitespace-only differences as the same skill' do
      create_with('React', 'react')
      expect(response).to have_http_status(:unprocessable_entity)
      create_with('React', '  React  ')
      expect(response).to have_http_status(:unprocessable_entity)
      create_with('React  Native', 'react native')
      expect(response).to have_http_status(:unprocessable_entity)
    end

    it 'accepts distinct skills' do
      create_with('React', 'React Native', 'Communication')
      expect(response).to have_http_status(:created)
    end
  end

  describe 'updating' do
    let(:assessment) { create_assessment(org: org, skills: [{ skill_label: 'React' }, { skill_label: 'Communication' }]) }

    it 'rejects adding a skill that is already listed' do
      patch "/api/v1/assessments/#{assessment.id}", headers: headers,
                                                    params: { assessment: { assessment_skills_attributes: [anchors.merge(skill_label: 'react ', display_order: 2)] } }
      expect(response).to have_http_status(:unprocessable_entity)
      expect(assessment.reload.assessment_skills.count).to eq(2)
    end

    it 'rejects renaming a skill to match another' do
      comm = assessment.assessment_skills.find_by(skill_label: 'Communication')
      patch "/api/v1/assessments/#{assessment.id}", headers: headers,
                                                    params: { assessment: { assessment_skills_attributes: [{ id: comm.id, skill_label: 'REACT' }] } }
      expect(response).to have_http_status(:unprocessable_entity)
      expect(comm.reload.skill_label).to eq('Communication')
    end

    context 'when an existing assessment already contains a duplicate (saved before this rule)' do
      let(:assessment) { create_assessment(org: org, skills: [{ skill_label: 'React' }, { skill_label: 'React' }]) }

      it 'still allows unrelated edits, such as the name or time limit' do
        patch "/api/v1/assessments/#{assessment.id}", headers: headers, params: { assessment: { name: 'Renamed', time_limit_min: 45 } }
        expect(response).to have_http_status(:ok)
        expect(assessment.reload).to have_attributes(name: 'Renamed', time_limit_min: 45)
      end

      it 'can be corrected by removing the duplicate' do
        dup = assessment.assessment_skills.order(:id).last
        patch "/api/v1/assessments/#{assessment.id}", headers: headers,
                                                      params: { assessment: { assessment_skills_attributes: [{ id: dup.id, _destroy: '1' }] } }
        expect(response).to have_http_status(:ok)
        expect(assessment.reload.assessment_skills.pluck(:skill_label)).to eq(['React'])
      end
    end
  end
end
