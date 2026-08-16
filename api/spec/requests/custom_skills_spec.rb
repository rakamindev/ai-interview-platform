# frozen_string_literal: true

require 'rails_helper'

# Custom skills are tenant-scoped (same isolation rules as the portfolio fix):
# tenant A must only ever see its own library.
RSpec.describe 'Custom skills API', type: :request do
  let!(:tenant_a) { create(:organization, scheme: 'tenant-a', identifier: 'tenant-a', name: 'Tenant A', host: 'a.example.com') }
  let!(:tenant_b) { create(:organization, scheme: 'tenant-b', identifier: 'tenant-b', name: 'Tenant B', host: 'b.example.com') }

  let(:auth_a) do
    token = JsonWebToken.encode({ user_id: 1, role: 'admin', scheme: 'tenant-a' })
    { 'Authorization' => "Bearer #{token}" }
  end

  let(:valid_params) do
    {
      custom_skill: {
        skill_label:  'Data Analysis',
        scope_include: 'Statistical reasoning with real datasets',
        l1_anchor:    'Knows basic charts',
        l2_anchor:    'Can compute averages',
        l3_anchor:    'Applies regression',
        l4_anchor:    'Designs experiments',
        l5_anchor:    'Leads data strategy'
      }
    }
  end

  it 'creates a custom skill for the caller tenant' do
    post '/api/v1/custom_skills', params: valid_params, headers: auth_a

    expect(response).to have_http_status(:created)
    skill = CustomSkill.last
    expect(skill.tenant_id).to eq(tenant_a.id)
    expect(skill.created_by).to eq(1)
  end

  it 'lists only the caller tenant custom skills' do
    create(:custom_skill, tenant_id: tenant_b.id, skill_label: 'Tenant B Skill')

    get '/api/v1/custom_skills', headers: auth_a

    expect(response).to have_http_status(:ok)
    labels = JSON.parse(response.body).fetch('custom_skills').map { |s| s['skill_label'] }
    expect(labels).not_to include('Tenant B Skill')
  end

  it 'cannot destroy another tenant custom skill' do
    foreign = create(:custom_skill, tenant_id: tenant_b.id, skill_label: 'Tenant B Skill')

    delete "/api/v1/custom_skills/#{foreign.id}", headers: auth_a

    expect(response).to have_http_status(:not_found)
    expect(CustomSkill.exists?(foreign.id)).to be(true)
  end

  it 'destroys its own custom skill' do
    own = create(:custom_skill, tenant_id: tenant_a.id, skill_label: 'My Skill')

    delete "/api/v1/custom_skills/#{own.id}", headers: auth_a

    expect(response).to have_http_status(:ok)
    expect(CustomSkill.exists?(own.id)).to be(false)
  end
end
