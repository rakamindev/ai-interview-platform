# frozen_string_literal: true

require 'rails_helper'

# Which organization a request belongs to, before any controller runs.
RSpec.describe TenantResolverMiddleware do
  let!(:acme)  { create(:organization, scheme: 'acme', host: 'acme.example.test') }
  let!(:other) { create(:organization, scheme: 'other', host: 'other.example.test') }

  # Runs the middleware and returns the tenant id the app behind it saw.
  def tenant_for(headers = {})
    seen = :unset
    app = ->(_env) { seen = RequestStore.store[:tenant_id]; [200, {}, ['ok']] }
    env = Rack::MockRequest.env_for('/api/v1/assessments', headers.transform_keys { "HTTP_#{_1.upcase.tr('-', '_')}" })

    described_class.new(app).call(env)
    seen
  end

  def bearer(scheme) = "Bearer #{JsonWebToken.encode({ user_id: 1, role: 'admin', scheme: })}"

  after { RequestStore.clear! }

  it 'takes the tenant from the JWT scheme claim' do
    expect(tenant_for('Authorization' => bearer('acme'))).to eq(acme.id)
  end

  it 'prefers the JWT over the X-Tenant-Scheme header' do
    expect(tenant_for('Authorization' => bearer('acme'), 'X-Tenant-Scheme' => 'other')).to eq(acme.id)
  end

  it 'falls back to the X-Tenant-Scheme header without a token' do
    expect(tenant_for('X-Tenant-Scheme' => 'other')).to eq(other.id)
  end

  it 'falls back to the header when the token is not a JWT' do
    expect(tenant_for('Authorization' => 'Bearer not-a-jwt', 'X-Tenant-Scheme' => 'other')).to eq(other.id)
  end

  it 'falls back to the Referer host last' do
    expect(tenant_for('Referer' => 'https://acme.example.test/interview/abc')).to eq(acme.id)
  end

  it 'sets no tenant when nothing identifies one' do
    expect(tenant_for).to be_nil
  end

  it 'sets no tenant for an unknown scheme when there is no default organization' do
    expect(tenant_for('X-Tenant-Scheme' => 'nobody')).to be_nil
  end

  it 'ignores a malformed Referer' do
    expect(tenant_for('Referer' => 'http://exa mple.test/%%')).to be_nil
  end

  # Organization.identify falls back to the system organization (id 0) for any scheme it doesn't know.
  it 'resolves an unknown scheme to the default organization when one exists' do
    create(:organization, id: 0, scheme: 'system')

    expect(tenant_for('X-Tenant-Scheme' => 'nobody')).to eq(0)
  end
end
