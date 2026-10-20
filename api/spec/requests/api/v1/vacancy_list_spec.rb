# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Vacancy list API', type: :request do
  let(:organization) { create(:organization) }
  let(:headers) { assessor_headers(organization) }

  it 'filters vacancies by role title within the current tenant' do
    create(:vacancy, organization: organization, role_title: 'Frontend Engineer')
    create(:vacancy, organization: organization, role_title: 'Platform Engineer')
    other_organization = create(:organization)
    create(:vacancy, organization: other_organization, role_title: 'Frontend Engineer')

    get '/api/v1/vacancies',
        params: { search: 'Frontend' },
        headers: headers

    expect(response).to have_http_status(:ok)
    body = JSON.parse(response.body)
    expect(body.fetch('vacancies').map { |item| item.fetch('role_title') }).to eq(['Frontend Engineer'])
    expect(body.fetch('meta').fetch('total_count')).to eq(1)
  end
end
