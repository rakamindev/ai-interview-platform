# frozen_string_literal: true

require 'rails_helper'

RSpec.describe TenantResolverMiddleware do
  describe '#scheme_from_jwt' do
    let(:middleware) { described_class.new(nil) }

    def request_with_bearer_token(token)
      env = {
        'HTTP_AUTHORIZATION' => "Bearer #{token}",
        'REQUEST_METHOD' => 'GET',
        'PATH_INFO' => '/',
        'rack.url_scheme' => 'http'
      }

      ActionDispatch::Request.new(env)
    end

    it 'uses verified JWT decoding to resolve the tenant scheme' do
      request = request_with_bearer_token('valid-token')

      allow(JsonWebToken).to receive(:decode)
        .with('valid-token')
        .and_return({ scheme: 'tenant-a' })

      expect(middleware.send(:scheme_from_jwt, request)).to eq('tenant-a')
      expect(JsonWebToken).not_to receive(:decode_without_verification)
    end

    it 'ignores the scheme when JWT verification fails' do
      request = request_with_bearer_token('forged-token')

      allow(JsonWebToken).to receive(:decode)
        .with('forged-token')
        .and_raise(ExceptionHandler::InvalidToken, 'Invalid token')

      expect(middleware.send(:scheme_from_jwt, request)).to be_nil
    end
  end
end
