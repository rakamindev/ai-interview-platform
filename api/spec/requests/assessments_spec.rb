# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Assessments', type: :request do
  before do
    @organization = Organization.create!(
      name: 'Test Org', scheme: 'test-org', identifier: 'test-org', host: 'test-org.test'
    )
  end

  describe 'GET /api/v1/assessments' do
    it "includes why the latest session failed" do
      within_organization do
        assessment = Assessment.new(name: 'Jr. Backend Engineer', time_limit_min: 30, created_by: 1)
        assessment.save!
        Session.new(assessment: assessment, candidate_name: 'Test Candidate A').save!
        assessment.sessions.last.record_failure!('assessment_invalid', 'duplicate skills')
      end

      get_json '/api/v1/assessments', {}, as_admin(@organization)

      latest = response_body['assessments'].first['latest_session']
      expect(latest).to include(
        'status' => 'pending', 'failure_code' => 'assessment_invalid',
        'failure_message' => 'Assessment needs fixing (duplicate skills).'
      )
    end
  end

  describe 'POST /api/v1/assessments' do
    it 'returns ok with valid inputs' do
      post_json '/api/v1/assessments', {
        assessment: {
          name: 'Jr. Backend Engineer', time_limit_min: 30,
          assessment_skills_attributes: [
            skill_attributes(skill_label: 'RESTful API Design'),
            skill_attributes(skill_label: 'Ruby on Rails', display_order: 1)
          ]
        }
      }, as_admin(@organization)

      expect(response).to have_http_status(201)
      expect(AssessmentSkill.count).to eq(2)
      expect(SystemPromptGeneratorWorker.jobs.size).to eq(1)
    end

    it 'returns error when two skills have the same label' do
      post_json '/api/v1/assessments', {
        assessment: {
          name: 'Jr. Backend Engineer', time_limit_min: 30,
          assessment_skills_attributes: [
            skill_attributes(skill_label: 'RESTful API Design'),
            skill_attributes(skill_label: 'restful api design', display_order: 1)
          ]
        }
      }, as_admin(@organization)

      expect(response).to have_http_status(422)
      expect(response_body['errors'].first['message']).to eq("Skill 'RESTful API Design' is listed more than once")
      expect(Assessment.count).to eq(0)
      expect(SystemPromptGeneratorWorker.jobs.size).to eq(0)
    end
  end

  describe 'PUT /api/v1/assessments/:id' do
    before do
      within_organization do
        @assessment = Assessment.new(
          name: 'Jr. Backend Engineer', time_limit_min: 30, created_by: 1,
          assessment_skills_attributes: [skill_attributes(skill_label: 'RESTful API Design')]
        )
        @assessment.save!
      end
    end

    it 'returns error when adding a skill with the same label as a saved one' do
      put_json "/api/v1/assessments/#{@assessment.id}", {
        assessment: {
          time_limit_min: 45,
          assessment_skills_attributes: [skill_attributes(skill_label: 'restful api design', display_order: 1)]
        }
      }, as_admin(@organization)

      expect(response).to have_http_status(422)
      expect(response_body['errors'].first['message']).to eq("Skill 'RESTful API Design' is listed more than once")
      expect(@assessment.reload.time_limit_min).to eq(30)
      expect(@assessment.assessment_skills.count).to eq(1)
      expect(SystemPromptGeneratorWorker.jobs.size).to eq(0)
    end
  end
end
