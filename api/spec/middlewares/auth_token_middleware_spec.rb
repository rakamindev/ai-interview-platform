require 'rails_helper'

RSpec.describe AuthTokenMiddleware do
  let(:app) { ->(env) { [200, { 'Content-Type' => 'text/plain' }, ['OK']] } }
  let(:middleware) { described_class.new(app) }
  let(:env) { { 'HTTP_AUTHORIZATION' => "Bearer #{token}" } }
  let(:user) { OpenStruct.new(id: 1, role: 'admin', scheme: 'test') }
  let(:token) { JsonWebToken.encode(user_id: user.id, role: user.role, scheme: user.scheme) }

  before do
    Current.user = nil
  end

  context 'when no roles are required' do
    it 'calls the app and sets Current.user' do
      status, _, _ = middleware.call(env)
      expect(status).to eq(200)
      expect(Current.user.id).to eq(1)
    end

    it 'calls the app even if token is missing or invalid' do
      status, _, _ = middleware.call({})
      expect(status).to eq(200)
      expect(Current.user).to be_nil
    end
  end

  context 'when roles are required' do
    let(:middleware) { described_class.new(app, :admin) }

    it 'allows valid request and sets user' do
      status, _, _ = middleware.call(env)
      expect(status).to eq(200)
      expect(Current.user.id).to eq(1)
    end

    it 'returns 401 for missing token' do
      status, headers, body = middleware.call({})
      expect(status).to eq(401)
      expect(JSON.parse(body.first)['errors'].first['message']).to eq(Message.missing_token)
    end

    it 'returns 401 for invalid token' do
      status, headers, body = middleware.call({ 'HTTP_AUTHORIZATION' => 'Bearer invalid' })
      expect(status).to eq(401)
      expect(JSON.parse(body.first)['errors'].first['message']).to include('Not enough or too many segments')
    end

    it 'returns 403 for unauthorized role' do
      user.role = 'user'
      token = JsonWebToken.encode(user_id: user.id, role: user.role, scheme: user.scheme)
      env['HTTP_AUTHORIZATION'] = "Bearer #{token}"

      status, headers, body = middleware.call(env)
      expect(status).to eq(403)
      expect(JSON.parse(body.first)['errors'].first['message']).to eq(Message.unauthorized)
    end
  end

  context 'when StandardError is raised in Auth' do
    let(:middleware) { described_class.new(app, :admin) }
    
    before do
      allow(AuthorizeApiRequest).to receive(:new).and_raise(StandardError.new('Unexpected'))
    end

    it 'returns 401 with generic message' do
      status, _, body = middleware.call(env)
      expect(status).to eq(401)
      expect(JSON.parse(body.first)['errors'].first['message']).to eq('Request not authenticated')
    end
  end
end
