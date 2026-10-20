# frozen_string_literal: true

require 'spec_helper'

RSpec.describe Api::V1::VacanciesController, type: :controller do
  it 'filters vacancies by a case-insensitive, escaped role title search' do
    scope = double('vacancy scope')
    page = double('paginated vacancies', current_page: 1, total_pages: 1, total_count: 0, limit_value: 10)
    authorizer = instance_double(AuthorizeApiRequest, call: { user: OpenStruct.new(id: 1, role: 'assessor') })

    Current.organization = OpenStruct.new(id: 1)
    allow(AuthorizeApiRequest).to receive(:new).and_return(authorizer)
    allow(Vacancy).to receive(:unarchived).and_return(scope)
    allow(scope).to receive(:includes).with(:vacancy_skills).and_return(scope)
    allow(scope).to receive(:order).with(created_at: :desc).and_return(scope)
    expect(scope).to receive(:where).with(status: 'active').and_return(scope)
    expect(scope).to receive(:where).with('role_title ILIKE ?', '%Engineer\\%\\_%').and_return(scope)
    expect(controller).to receive(:paginate).with(scope, per_page: 10).and_return(page)
    allow(page).to receive(:map).and_return([])

    get :index, params: { search: 'Engineer%_', page: 2, status: 'active' }

    expect(response).to have_http_status(:ok)
  end
end

RSpec.describe Api::V1::VacanciesController, type: :controller do
  it 'updates status through the status endpoint' do
    vacancy = double('vacancy')
    authorizer = double(call: { user: OpenStruct.new(id: 1, role: 'assessor') })

    Current.organization = OpenStruct.new(id: 1)
    allow(AuthorizeApiRequest).to receive(:new).and_return(authorizer)
    allow(Vacancy).to receive(:unarchived).and_return(double(find: vacancy))
    expect(vacancy).to receive(:update_status).with('closed').and_return(true)
    allow(controller).to receive(:vacancy_json).and_return(status: 'closed')

    patch :update_status, params: { id: 12, vacancy: { status: 'closed' } }

    expect(response).to have_http_status(:ok)
  end

  it 'loads taxonomy anchors by label for legacy vacancy skills without an ID' do
    skill = double(id: 12, skill_id: nil, skill_label: 'Legacy skill', expected_level: 3)
    vacancy = double(vacancy_skills: [skill])
    taxonomy = double(
      skill_id: 'SK-001',
      skill_label: 'Legacy skill',
      l1_anchor: 'L1 details',
      l2_anchor: 'L2 details',
      l3_anchor: 'L3 details',
      l4_anchor: 'L4 details',
      l5_anchor: 'L5 details'
    )
    by_id = double
    by_label = double
    allow(SkillTaxonomy).to receive(:where).with(skill_id: []).and_return(by_id)
    allow(SkillTaxonomy).to receive(:where).with(skill_label: ['Legacy skill']).and_return(by_label)
    allow(by_id).to receive(:or).with(by_label).and_return([taxonomy])
    allow(controller).to receive(:vacancy_json).with(vacancy).and_return({})

    result = controller.send(:vacancy_with_skills_json, vacancy)

    expect(result.dig(:skills, 0, :l1_anchor)).to eq('L1 details')
    expect(result.dig(:skills, 0, :l5_anchor)).to eq('L5 details')
  end
end
