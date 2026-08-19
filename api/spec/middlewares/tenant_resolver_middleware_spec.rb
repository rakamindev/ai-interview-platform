require 'rails_helper'

RSpec.describe TenantResolverMiddleware do
  let(:app) { ->(env) { [200, env, ['OK']] } }
  let(:middleware) { described_class.new(app) }
  let!(:organization) { create(:organization, id: 100, scheme: 'test-corp', host: 'test-corp.example.com') }
  
  before do
    Current.organization = nil
    Current.tenant_id = nil
  end

  after do
    Current.clear
  end

  context 'when resolving via JWT scheme' do
    let(:token) { JsonWebToken.encode(user_id: 1, scheme: 'test-corp') }
    let(:env) { { 'HTTP_AUTHORIZATION' => "Bearer #{token}" } }

    it 'sets Current.organization and tenant_id' do
      middleware.call(env)
      expect(Current.organization).to eq(organization)
      expect(Current.tenant_id).to eq(organization.id)
    end

    it 'does nothing for invalid token' do
      middleware.call({ 'HTTP_AUTHORIZATION' => "Bearer invalid" })
      expect(Current.organization).to be_nil
    end
  end

  context 'when resolving via X-Tenant-Scheme header' do
    let(:env) { { 'HTTP_X_TENANT_SCHEME' => 'test-corp' } }

    it 'sets Current.organization and tenant_id' do
      middleware.call(env)
      expect(Current.organization).to eq(organization)
    end
  end

  context 'when resolving via referer host' do
    let(:env) { { 'HTTP_REFERER' => 'https://test-corp.example.com/some/path' } }

    it 'sets Current.organization and tenant_id' do
      middleware.call(env)
      expect(Current.organization).to eq(organization)
    end
  end

  context 'when no tenant can be resolved' do
    let(:env) { {} }

    it 'leaves Current empty and continues' do
      status, _, _ = middleware.call(env)
      expect(status).to eq(200)
      expect(Current.organization).to be_nil
      expect(Current.tenant_id).to be_nil
    end
  end
end
