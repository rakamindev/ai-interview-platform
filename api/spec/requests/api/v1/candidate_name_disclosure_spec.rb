require 'rails_helper'

RSpec.describe 'GET /api/v1/sessions/:token/candidate — candidate_name disclosure (F-003)', type: :request do
  it 'includes candidate_name when the assessor set one' do
    session = create(:session, candidate_name: 'Budi Santoso')

    get "/api/v1/sessions/#{session.invite_token}/candidate"

    body = JSON.parse(response.body)
    expect(body['candidate_name']).to eq('Budi Santoso')
  end

  it 'returns nil candidate_name when the assessor never set one' do
    session = create(:session, candidate_name: nil)

    get "/api/v1/sessions/#{session.invite_token}/candidate"

    body = JSON.parse(response.body)
    expect(body['candidate_name']).to be_nil
  end
end
