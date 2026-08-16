# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Skill taxonomies', type: :request do
  let!(:org) { create(:organization, scheme: 'acme') }

  it 'show returns the record under the skill_taxonomy key (P5-2)' do
    create(:skill_taxonomy, skill_id: 'SK-ENG-001')

    get '/api/v1/skill_taxonomies/SK-ENG-001', headers: bearer_for(organization: org)

    expect(response).to have_http_status(:ok)
    body = JSON.parse(response.body)
    expect(body).to have_key('skill_taxonomy')
    expect(body['skill_taxonomy']['skill_id']).to eq('SK-ENG-001')
  end
end
