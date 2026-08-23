# frozen_string_literal: true

require 'rails_helper'
require 'rack'

RSpec.describe TenantResolverMiddleware do
  let(:app) { ->(_env) { [200, {}, ['ok']] } }
  let(:middleware) { described_class.new(app) }

  def call_middleware(headers = {})
    env = Rack::MockRequest.env_for('/', headers)
    middleware.call(env)
  end

  around do |ex|
    ex.run
    RequestStore.clear!
  end

  describe 'when a Bearer token is present' do
    it 'uses the scheme from the VERIFIED token and ignores X-Tenant-Scheme' do
      create_organization!(scheme: 'spec-org-a')
      create_organization!(scheme: 'spec-org-b')
      token = JsonWebToken.encode({ user_id: 1, role: 'admin', scheme: 'spec-org-a' })

      call_middleware(
        'HTTP_AUTHORIZATION' => "Bearer #{token}",
        'HTTP_X_TENANT_SCHEME' => 'spec-org-b'
      )

      expect(Current.organization.scheme).to eq('spec-org-a')
    end

    it 'does not fall back to the header when the token signature is invalid' do
      forged = JWT.encode({ user_id: 1, role: 'admin', scheme: 'spec-org-b' }, 'wrong-secret', 'HS256')

      call_middleware(
        'HTTP_AUTHORIZATION' => "Bearer #{forged}",
        'HTTP_X_TENANT_SCHEME' => 'spec-org-b'
      )

      expect(RequestStore.store).not_to have_key(:organization)
      expect(RequestStore.store).not_to have_key(:tenant_id)
    end

    it 'does not resolve a tenant from a valid token lacking the scheme claim' do
      create_organization!(scheme: 'spec-org-b')
      token = JsonWebToken.encode({ user_id: 1, role: 'admin' })

      call_middleware(
        'HTTP_AUTHORIZATION' => "Bearer #{token}",
        'HTTP_X_TENANT_SCHEME' => 'spec-org-b'
      )

      expect(RequestStore.store).not_to have_key(:organization)
      expect(RequestStore.store).not_to have_key(:tenant_id)
    end
  end

  describe 'when no Bearer token is present' do
    it 'falls back to X-Tenant-Scheme (candidate flows)' do
      create_organization!(scheme: 'spec-org-a')

      call_middleware('HTTP_X_TENANT_SCHEME' => 'spec-org-a')

      expect(Current.organization.scheme).to eq('spec-org-a')
    end
  end
end
