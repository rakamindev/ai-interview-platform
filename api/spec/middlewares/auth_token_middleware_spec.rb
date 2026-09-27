# frozen_string_literal: true

require 'rails_helper'

RSpec.describe AuthTokenMiddleware do
  let(:inner_app) { ->(env) { [200, { 'Content-Type' => 'text/plain' }, ['OK']] } }
  let(:middleware) { described_class.new(inner_app, :admin) }
  let(:valid_token) { JsonWebToken.encode({ user_id: 42, role: 'admin', scheme: 'test-corp' }) }

  before do
    Current.user = nil
  end

  after do
    Current.user = nil
  end

  describe '#call' do
    context 'with a valid token' do
      it 'sets Current.user and calls the downstream app' do
        env = Rack::MockRequest.env_for('/api/v1/protected', 'HTTP_AUTHORIZATION' => "Bearer #{valid_token}")

        status, _headers, body = middleware.call(env)

        expect(status).to eq(200)
        expect(body).to eq(['OK'])
        expect(Current.user).to be_present
        expect(Current.user.id).to eq(42)
        expect(Current.user.role).to eq('admin')
      end
    end

    context 'with a missing token' do
      it 'returns 401 unauthorized' do
        env = Rack::MockRequest.env_for('/api/v1/protected')

        status, headers, body = middleware.call(env)

        expect(status).to eq(401)
        expect(headers['Content-Type']).to include('application/json')
        parsed = JSON.parse(body.first)
        expect(parsed['errors'].first['status']).to eq(401)
      end
    end

    context 'with an unauthorized role' do
      let(:user_token) { JsonWebToken.encode({ user_id: 99, role: 'candidate', scheme: 'test-corp' }) }

      it 'returns 403 forbidden' do
        env = Rack::MockRequest.env_for('/api/v1/protected', 'HTTP_AUTHORIZATION' => "Bearer #{user_token}")

        status, headers, body = middleware.call(env)

        expect(status).to eq(403)
        expect(headers['Content-Type']).to include('application/json')
        parsed = JSON.parse(body.first)
        expect(parsed['errors'].first['status']).to eq(403)
      end

      it 'does not poison subsequent valid requests after a 403 forbidden' do
        forbidden_env = Rack::MockRequest.env_for('/api/v1/protected', 'HTTP_AUTHORIZATION' => "Bearer #{user_token}")
        forbidden_status, _, _ = middleware.call(forbidden_env)
        expect(forbidden_status).to eq(403)

        valid_env = Rack::MockRequest.env_for('/api/v1/protected', 'HTTP_AUTHORIZATION' => "Bearer #{valid_token}")
        second_status, _, second_body = middleware.call(valid_env)

        expect(second_status).to eq(200)
        expect(second_body).to eq(['OK'])
        expect(Current.user.id).to eq(42)
      end
    end

    context 'when no roles are required (optional authentication)' do
      let(:optional_middleware) { described_class.new(inner_app) }

      it 'passes through unauthenticated requests without setting Current.user' do
        env = Rack::MockRequest.env_for('/api/v1/public')

        status, _, body = optional_middleware.call(env)

        expect(status).to eq(200)
        expect(body).to eq(['OK'])
        expect(Current.user).to be_nil
      end

      it 'sets Current.user when a valid token is provided' do
        env = Rack::MockRequest.env_for('/api/v1/public', 'HTTP_AUTHORIZATION' => "Bearer #{valid_token}")

        status, _, body = optional_middleware.call(env)

        expect(status).to eq(200)
        expect(body).to eq(['OK'])
        expect(Current.user).to be_present
        expect(Current.user.id).to eq(42)
      end
    end

    context 'when an invalid/failed request is followed by a valid request on the same instance (P0-5 singleton leak)' do
      it 'does not poison subsequent requests on the same middleware instance' do
        failed_env = Rack::MockRequest.env_for('/api/v1/protected')
        failed_status, _, _ = middleware.call(failed_env)
        expect(failed_status).to eq(401)

        valid_env = Rack::MockRequest.env_for('/api/v1/protected', 'HTTP_AUTHORIZATION' => "Bearer #{valid_token}")
        second_status, _, second_body = middleware.call(valid_env)

        expect(second_status).to eq(200)
        expect(second_body).to eq(['OK'])
        expect(Current.user).to be_present
        expect(Current.user.id).to eq(42)
      end
    end
  end
end
