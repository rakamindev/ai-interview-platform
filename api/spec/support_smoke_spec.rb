# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'test harness' do
  it 'builds a full portfolio graph from factories' do
    skill = create(:portfolio_skill)

    expect(skill.portfolio.session.assessment.tenant_id).to be_present
    expect(skill.portfolio.session.tenant_id).to eq(skill.portfolio.session.assessment.tenant_id)
  end

  it 'blocks real HTTP calls to Gemini' do
    expect { Net::HTTP.get(URI('https://generativelanguage.googleapis.com/v1/models')) }
      .to raise_error(WebMock::NetConnectNotAllowedError)
  end
end
