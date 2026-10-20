# frozen_string_literal: true

require 'rails_helper'

# The skill library endpoints behind the assessment builder's skill picker.
RSpec.describe 'Skill taxonomies', type: :request do
  let(:organization) { create(:organization) }
  let(:headers)      { auth_headers_for(organization) }

  def create_skill(skill_id, label, category)
    SkillTaxonomy.create!(skill_id:, skill_label: label, category:, scope_include: 'Hooks, state',
                          l1_anchor: 'L1', l2_anchor: 'L2', l3_anchor: 'L3', l4_anchor: 'L4', l5_anchor: 'L5')
  end

  before do
    create_skill('SK-SOFT-001', 'Communication', 'soft_skills')
    create_skill('SK-ENG-001', 'React', 'engineering')
  end

  def json = response.parsed_body

  it 'lists every skill ordered by id, with its level anchors' do
    get '/api/v1/skill_taxonomies', headers: headers

    expect(response).to have_http_status(:ok)
    expect(json['skill_taxonomies'].pluck('skill_id')).to eq(%w[SK-ENG-001 SK-SOFT-001])
    expect(json['skill_taxonomies'].first).to include('skill_label' => 'React', 'category' => 'engineering',
                                                      'scope_include' => 'Hooks, state', 'l5_anchor' => 'L5')
  end

  it 'filters by category' do
    get '/api/v1/skill_taxonomies', params: { category: 'soft_skills' }, headers: headers

    expect(json['skill_taxonomies'].pluck('skill_label')).to eq(['Communication'])
  end

  it 'shows one skill by its id' do
    get '/api/v1/skill_taxonomies/SK-ENG-001', headers: headers

    expect(json.dig('skill', 'skill_label')).to eq('React')
  end

  it 'returns 404 for an unknown skill id' do
    get '/api/v1/skill_taxonomies/SK-NOPE-999', headers: headers

    expect(response).to have_http_status(:not_found)
  end

  it 'needs an assessor token' do
    get '/api/v1/skill_taxonomies', headers: { 'X-Tenant-Scheme' => organization.scheme }

    expect(response).to have_http_status(:unauthorized)
  end
end
