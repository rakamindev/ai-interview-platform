# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Assessment configuration API', type: :request do
  let(:organization) { create(:organization) }
  let(:headers) { assessor_headers(organization) }

  before { allow(SystemPromptGeneratorWorker).to receive(:perform_async) }

  def valid_skill(overrides = {})
    {
      skill_id:       'skill-ruby',
      skill_label:    'Ruby',
      scope_include:  'Reads and writes Ruby in production.',
      l1_anchor:      'Recognises Ruby syntax.',
      l2_anchor:      'Writes small Ruby scripts.',
      l3_anchor:      'Ships a Ruby service change.',
      l4_anchor:      'Designs Ruby service boundaries.',
      l5_anchor:      'Sets Ruby practice for the team.',
      expected_level: 3,
      display_order:  0
    }.merge(overrides)
  end

  def create_assessment(skills)
    post '/api/v1/assessments',
         params: {
           assessment: {
             name:                          'Synthetic Backend Screen',
             time_limit_min:                30,
             language:                      'en',
             assessment_skills_attributes:  skills
           }
         },
         headers: headers,
         as:      :json
  end

  def error_message
    JSON.parse(response.body).fetch('errors').first.fetch('message')
  end

  it 'saves a taxonomy-backed skill with its identity intact' do
    create_assessment([valid_skill])

    expect(response).to have_http_status(:created)
    saved = Assessment.find_by(name: 'Synthetic Backend Screen').assessment_skills.first
    expect(saved.skill_id).to eq('skill-ruby')
    expect(saved.scope_include).to eq('Reads and writes Ruby in production.')
  end

  it 'accepts a custom skill without a taxonomy identity' do
    create_assessment([valid_skill(skill_id: nil, is_custom: true, skill_label: 'Stakeholder calm')])

    expect(response).to have_http_status(:created)
    saved = Assessment.find_by(name: 'Synthetic Backend Screen').assessment_skills.first
    expect(saved.skill_id).to be_nil
    expect(saved.is_custom).to be(true)
  end

  it 'rejects a configured skill with no taxonomy identity' do
    create_assessment([valid_skill(skill_id: nil)])

    expect(response).to have_http_status(:unprocessable_entity)
    expect(error_message).to eq('Skill id is required')
  end

  it 'rejects a skill with a missing anchor' do
    create_assessment([valid_skill(l3_anchor: '')])

    expect(response).to have_http_status(:unprocessable_entity)
    expect(error_message).to eq('Skill anchors L1-L5 are required')
  end

  it 'rejects a skill with no scope' do
    create_assessment([valid_skill(scope_include: nil)])

    expect(response).to have_http_status(:unprocessable_entity)
    expect(error_message).to eq('Skill scope is required')
  end

  it 'rejects an identity longer than the configured column' do
    create_assessment([valid_skill(skill_id: 'x' * 51)])

    expect(response).to have_http_status(:unprocessable_entity)
    expect(error_message).to eq('Skill id is too long (maximum is 50 characters)')
  end
  it 'filters the assessment index by search and live status without leaving the tenant' do
    create(:assessment, organization: organization, name: 'Frontend Screen')
    live = create(:assessment, organization: organization, name: 'Live Backend Screen')
    create(:session, organization: organization, assessment: live, status: 'active')

    get '/api/v1/assessments',
        params: { search: 'Live', status: 'live' },
        headers: headers

    expect(response).to have_http_status(:ok)
    body = JSON.parse(response.body)
    expect(body.fetch('assessments').map { |item| item.fetch('name') }).to eq(['Live Backend Screen'])
    expect(body.fetch('meta').fetch('total_count')).to eq(1)
  end
end
