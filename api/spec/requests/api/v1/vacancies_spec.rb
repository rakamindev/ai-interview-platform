# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Vacancies API', type: :request do
  let!(:organization) do
    Organization.find_or_create_by!(scheme: 'test-corp') do |org|
      org.name = 'Test Corp'
      org.identifier = 'test-corp'
      org.host = 'localhost'
    end
  end

  let!(:admin_user) do
    User.create!(
      email: 'recruiter.vacancies@example.com',
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

  describe 'POST /api/v1/vacancies' do
    it 'creates a vacancy with B7 taxonomy skills and returns preloaded anchors' do
      payload = {
        vacancy: {
          role_title: 'Staff Frontend Engineer',
          culture_dimensions: 'High autonomy, continuous learning',
          competency_expectations: 'Production React at scale, mentoring engineers',
          vacancy_skills_attributes: [
            {
              skill_id: 'SK-ENG-001',
              skill_label: 'React / Frontend Development Core',
              expected_level: 4
            }
          ]
        }
      }

      post '/api/v1/vacancies', params: payload.to_json, headers: headers

      expect(response).to have_http_status(:created)
      body = JSON.parse(response.body)
      expect(body['vacancy']['role_title']).to eq('Staff Frontend Engineer')
      expect(body['vacancy']['skills']).to be_an(Array)
      expect(body['vacancy']['skills'].length).to eq(1)

      skill_response = body['vacancy']['skills'].first
      expect(skill_response['skill_id']).to eq('SK-ENG-001')
      expect(skill_response['expected_level']).to eq(4)
      expect(skill_response['l1_anchor']).to eq(taxonomy_skill.l1_anchor)
      expect(skill_response['l4_anchor']).to eq(taxonomy_skill.l4_anchor)

      created_vacancy = Vacancy.find(body['vacancy']['id'])
      expect(created_vacancy.created_by).to eq(admin_user.id)
      expect(created_vacancy.vacancy_skills.first.skill_id).to eq('SK-ENG-001')
    end

    it 'rejects unauthenticated requests' do
      post '/api/v1/vacancies',
           params: { vacancy: { role_title: 'Staff' } }.to_json,
           headers: { 'X-Tenant-Scheme' => 'test-corp', 'Content-Type' => 'application/json' }

      expect(response).to have_http_status(:unauthorized)
    end
  end

  describe 'GET /api/v1/vacancies/:id' do
    let!(:vacancy) do
      Current.tenant_id = organization.id
      v = Vacancy.create!(
        role_title: 'Lead Architect',
        created_by: admin_user.id
      )
      v.vacancy_skills.create!(
        skill_id: 'SK-ENG-001',
        skill_label: 'React / Frontend Development Core',
        expected_level: 5
      )
      v
    end

    it 'returns vacancy details and resolves B7 taxonomy anchors for skills' do
      get "/api/v1/vacancies/#{vacancy.id}", headers: headers

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body['vacancy']['role_title']).to eq('Lead Architect')

      skill_response = body['vacancy']['skills'].first
      expect(skill_response['skill_id']).to eq('SK-ENG-001')
      expect(skill_response['expected_level']).to eq(5)
      expect(skill_response['l5_anchor']).to eq(taxonomy_skill.l5_anchor)
    end
  end

  describe 'PUT /api/v1/vacancies/:id' do
    let!(:vacancy) do
      Current.tenant_id = organization.id
      Vacancy.create!(
        role_title: 'Senior Engineer',
        created_by: admin_user.id
      )
    end

    it 'updates vacancy attributes and skills' do
      update_payload = {
        vacancy: {
          role_title: 'Principal Engineer',
          culture_dimensions: 'Async-first, outcome-oriented'
        }
      }

      put "/api/v1/vacancies/#{vacancy.id}", params: update_payload.to_json, headers: headers

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body['vacancy']['role_title']).to eq('Principal Engineer')
      expect(vacancy.reload.role_title).to eq('Principal Engineer')
    end
  end

  describe 'GET /api/v1/vacancies' do
    before do
      Current.tenant_id = organization.id
      15.times do |i|
        Vacancy.create!(
          role_title: "Role #{i + 1}",
          created_by: admin_user.id
        )
      end
    end

    it 'returns paginated vacancies by default' do
      get '/api/v1/vacancies', headers: headers

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body['vacancies'].length).to eq(10)
      expect(body['meta']['total_count']).to eq(15)
      expect(body['meta']['total_pages']).to eq(2)
      expect(body['meta']['current_page']).to eq(1)
    end

    it 'returns all vacancies when ?all=true is requested' do
      get '/api/v1/vacancies?all=true', headers: headers

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body['vacancies'].length).to eq(15)
      expect(body['meta']['total_count']).to eq(15)
      expect(body['meta']['total_pages']).to eq(1)
      expect(body['meta']['current_page']).to eq(1)
    end
  end
end
