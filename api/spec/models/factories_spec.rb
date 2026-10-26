# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'factories' do
  it 'builds a complete portfolio graph in one tenant' do
    org = create(:organization)
    assessment = create(:assessment, organization: org)
    portfolio = create(:portfolio, session: create(:session, assessment:))
    vacancy = create(:vacancy, organization: org)

    expect(portfolio.session.tenant_id).to eq(org.id)
    expect(vacancy.tenant_id).to eq(org.id)
  end
end
