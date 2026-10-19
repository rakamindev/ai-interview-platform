# frozen_string_literal: true

require 'spec_helper'

RSpec.describe Api::V1::AssessmentsController, type: :controller do
  it 'filters assessments by a case-insensitive, escaped name search' do
    scope = double('assessment scope')
    page = double('paginated assessments', current_page: 1, total_pages: 1, total_count: 0, limit_value: 10)
    authorizer = instance_double(AuthorizeApiRequest, call: { user: OpenStruct.new(id: 1, role: 'assessor') })

    Current.organization = OpenStruct.new(id: 1)
    allow(AuthorizeApiRequest).to receive(:new).and_return(authorizer)
    allow(Assessment).to receive(:active).and_return(scope)
    allow(scope).to receive(:includes).with(:sessions).and_return(scope)
    allow(scope).to receive(:order).with(created_at: :desc).and_return(scope)
    expect(scope).to receive(:where).with('name ILIKE ?', '%Dev\\%\\_%').and_return(scope)
    expect(controller).to receive(:paginate).with(scope, per_page: 10).and_return(page)
    allow(page).to receive(:map).and_return([])

    get :index, params: { search: 'Dev%_', page: 2 }

    expect(response).to have_http_status(:ok)
  end
end
