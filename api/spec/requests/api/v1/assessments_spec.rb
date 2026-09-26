# frozen_string_literal: true

require 'rails_helper'
require 'sidekiq/testing'

Sidekiq::Testing.fake!

RSpec.describe 'Assessments API', type: :request do
  let!(:organization) do
    Organization.find_or_create_by!(scheme: 'test-corp') do |org|
      org.name = 'Test Corp'
      org.identifier = 'test-corp'
      org.host = 'localhost'
    end
  end

  let!(:admin_user) do
    User.create!(
      email: 'recruiter@example.com',
      password: 'password123',
      role: 'admin'
    )
  end

  let(:auth_token) do
    JsonWebToken.encode(user_id: admin_user.id, role: 'admin', scheme: 'test-corp')
  end

  let(:headers) do
    {
      'Authorization' => "Bearer #{auth_token}",
      'Content-Type' => 'application/json'
    }
  end

  let!(:taxonomy_skill) do
    SkillTaxonomy.find_or_create_by!(skill_id: 'SK-ENG-001') do |s|
      s.skill_label   = 'React / Frontend Development Core'
      s.category      = 'engineering'
      s.scope_include = 'Component design, state management, hooks'
      s.scope_exclude = 'Backend APIs, non-React frameworks'
      s.l1_anchor     = 'Implements components from specs with close review.'
      s.l2_anchor     = 'Builds routine features independently.'
      s.l3_anchor     = 'Designs and builds complex features end-to-end.'
      s.l4_anchor     = 'Defines frontend standards for the team.'
      s.l5_anchor     = 'Defines frontend architecture strategy for the org.'
    end
  end

  describe 'POST /api/v1/assessments' do
    it 'creates an assessment with B7 taxonomy and custom skills, saving string skill_id' do
      payload = {
        assessment: {
          name: 'Senior Frontend Engineer Assessment',
          time_limit_min: 45,
          language: 'id',
          assessment_skills_attributes: [
            {
              skill_id: 'SK-ENG-001',
              skill_label: 'React / Frontend Development Core',
              is_custom: false,
              expected_level: 4,
              display_order: 1,
              scope_include: taxonomy_skill.scope_include,
              scope_exclude: taxonomy_skill.scope_exclude,
              l1_anchor: taxonomy_skill.l1_anchor,
              l2_anchor: taxonomy_skill.l2_anchor,
              l3_anchor: taxonomy_skill.l3_anchor,
              l4_anchor: taxonomy_skill.l4_anchor,
              l5_anchor: taxonomy_skill.l5_anchor
            },
            {
              skill_id: nil,
              skill_label: 'Internal Framework Proficiency',
              is_custom: true,
              expected_level: 3,
              display_order: 2,
              l1_anchor: 'Basic usage of internal CLI',
              l2_anchor: 'Can build internal services',
              l3_anchor: 'Designs new internal plugins',
              l4_anchor: 'Maintains internal SDK',
              l5_anchor: 'Core framework architect'
            }
          ]
        }
      }

      post '/api/v1/assessments', params: payload.to_json, headers: headers

      expect(response).to have_http_status(:created)
      body = JSON.parse(response.body)
      expect(body['assessment']['name']).to eq('Senior Frontend Engineer Assessment')
      expect(body['assessment']['language']).to eq('id')
      expect(body['assessment']['time_limit_min']).to eq(45)

      created_assessment = Assessment.find(body['assessment']['id'])
      expect(created_assessment.created_by).to eq(admin_user.id)
      expect(created_assessment.language).to eq('id')
      expect(created_assessment.assessment_skills.count).to eq(2)

      b7_saved = created_assessment.assessment_skills.find_by(skill_id: 'SK-ENG-001')
      expect(b7_saved).to be_present
      expect(b7_saved.skill_id).to eq('SK-ENG-001')
      expect(b7_saved.is_custom).to be(false)
      expect(b7_saved.expected_level).to eq(4)

      custom_saved = created_assessment.assessment_skills.find_by(is_custom: true)
      expect(custom_saved).to be_present
      expect(custom_saved.skill_id).to be_nil
      expect(custom_saved.skill_label).to eq('Internal Framework Proficiency')
      expect(custom_saved.expected_level).to eq(3)
    end

    it 'rejects creation when auth token is missing' do
      post '/api/v1/assessments',
           params: { assessment: { name: 'Unauthorized' } }.to_json,
           headers: { 'X-Tenant-Scheme' => 'test-corp', 'Content-Type' => 'application/json' }

      expect(response).to have_http_status(:unauthorized)
    end
  end

  describe 'GET /api/v1/assessments/:id' do
    let!(:assessment) do
      Current.tenant_id = organization.id
      a = Assessment.create!(
        name: 'Backend Engineer Assessment',
        time_limit_min: 30,
        language: 'en',
        created_by: admin_user.id
      )
      a.assessment_skills.create!(
        skill_id: 'SK-ENG-001',
        skill_label: 'React / Frontend Development Core',
        is_custom: false,
        expected_level: 3,
        display_order: 1,
        l1_anchor: 'L1',
        l2_anchor: 'L2',
        l3_anchor: 'L3',
        l4_anchor: 'L4',
        l5_anchor: 'L5'
      )
      a
    end

    it 'returns the assessment with serialized skills and string skill_id' do
      get "/api/v1/assessments/#{assessment.id}", headers: headers

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body['assessment']['name']).to eq('Backend Engineer Assessment')
      expect(body['assessment']['language']).to eq('en')
      expect(body['assessment']['skills']).to be_an(Array)
      expect(body['assessment']['skills'].first['skill_id']).to eq('SK-ENG-001')
      expect(body['assessment']['skills'].first['expected_level']).to eq(3)
    end
  end

  describe 'PUT /api/v1/assessments/:id' do
    let!(:assessment) do
      Current.tenant_id = organization.id
      Assessment.create!(
        name: 'Initial Assessment Title',
        time_limit_min: 30,
        language: 'en',
        created_by: admin_user.id
      )
    end

    it 'updates assessment language and attributes successfully' do
      update_payload = {
        assessment: {
          name: 'Updated Assessment Title',
          language: 'id',
          time_limit_min: 60
        }
      }

      put "/api/v1/assessments/#{assessment.id}", params: update_payload.to_json, headers: headers

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body['assessment']['name']).to eq('Updated Assessment Title')
      expect(body['assessment']['language']).to eq('id')
      expect(body['assessment']['time_limit_min']).to eq(60)

      expect(assessment.reload.language).to eq('id')
      expect(assessment.time_limit_min).to eq(60)
    end
  end

  describe 'GET /api/v1/assessments/:assessment_id/sessions' do
    let!(:assessment) do
      Current.tenant_id = organization.id
      Assessment.create!(
        name: 'Interview Candidate Sessions',
        time_limit_min: 30,
        language: 'en',
        created_by: admin_user.id
      )
    end

    before do
      Current.tenant_id = organization.id
      3.times do |i|
        Session.create!(
          assessment: assessment,
          candidate_name: "Candidate #{i + 1}",
          status: 'pending'
        )
      end
    end

    it 'returns paginated sessions list with pagination metadata' do
      get "/api/v1/assessments/#{assessment.id}/sessions?page=1&per_page=2", headers: headers

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body['sessions']).to be_an(Array)
      expect(body['sessions'].length).to eq(2)
      expect(body['meta']).to be_present
      expect(body['meta']['current_page']).to eq(1)
      expect(body['meta']['total_pages']).to eq(2)
      expect(body['meta']['total_count']).to eq(3)
      expect(body['meta']['per_page']).to eq(2)
    end
  end
end
