# frozen_string_literal: true

RSpec.describe 'WebSocket authorization' do
  let!(:owner) do
    Organization.create!(name: 'WS Owner', scheme: 'ws-owner',
                         identifier: 'ws-owner', host: 'ws-owner.example.test')
  end
  let!(:other) do
    Organization.create!(name: 'WS Other', scheme: 'ws-other',
                         identifier: 'ws-other', host: 'ws-other.example.test')
  end
  let!(:user) do
    User.create!(email: 'ws-assessor@example.test', password: 'SyntheticPassword123!',
                 role: 'admin', organization: owner)
  end
  let!(:assessment) do
    Assessment.create!(tenant_id: owner.id, created_by: user.id,
                       name: 'WS assessment', time_limit_min: 30)
  end
  let!(:session) { Session.create!(tenant_id: owner.id, assessment: assessment) }

  def token(role: 'admin', scheme: owner.scheme)
    JsonWebToken.encode(user_id: user.id, role: role, scheme: scheme)
  end

  it 'allows only a current assessor of the owning tenant on coverage WebSocket' do
    middleware = CoverageWebSocketMiddleware.new(nil)

    expect(middleware.send(:authenticate_assessor_by_token, token, session.id.to_s)).to eq([session, nil])
    expect(middleware.send(:authenticate_assessor_by_token, token(role: 'candidate'), session.id.to_s).last).to eq('Authentication failed')
    expect(middleware.send(:authenticate_assessor_by_token, token(scheme: other.scheme), session.id.to_s).last).to eq('Authentication failed')
  end

  it 'applies the same account binding to the assessor audio path' do
    middleware = AudioWebSocketMiddleware.new(nil)
    env = Rack::MockRequest.env_for("/ws/sessions/#{session.id}/audio",
                                   'HTTP_AUTHORIZATION' => "Bearer #{token}")

    expect(middleware.send(:authenticate_and_load, env, session.id.to_s)).to eq([session, nil])
    env['HTTP_AUTHORIZATION'] = "Bearer #{token(scheme: other.scheme)}"
    expect(middleware.send(:authenticate_and_load, env, session.id.to_s).last).to eq('Authentication failed')
  end
end
