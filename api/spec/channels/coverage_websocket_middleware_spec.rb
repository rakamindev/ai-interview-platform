# frozen_string_literal: true

require_relative '../spec_helper'
require 'faye/websocket'

class Session
  def self.unscoped = self
  def self.where(**) = self
  def self.find_by(**); end
end

require_relative '../../app/channels/coverage_websocket_middleware'

RSpec.describe CoverageWebsocketMiddleware do
  let(:organization) { double(id: 9, scheme: 'tenant-a') }
  let(:user) { double(id: 4) }
  let(:middleware) { described_class.allocate }

  before do
    allow(JsonWebToken).to receive(:decode).with('signed-token').and_return(user_id: 4, scheme: 'tenant-a', role: 'admin')
    allow(Organization).to receive(:find_by).with(scheme: 'tenant-a').and_return(organization)
    allow(User).to receive(:find_by).with(id: 4).and_return(user)
  end

  it 'requires a persisted active assessor/admin membership before resolving a session' do
    membership = double(role: 'assessor')
    allow(TenantMembership).to receive(:active).and_return(TenantMembership)
    allow(TenantMembership).to receive(:find_by).with(user_id: 4, organization_id: 9).and_return(membership)
    session = double(id: 22)
    allow(Session).to receive(:find_by).with(id: '22').and_return(session)

    result, error = middleware.send(:authenticate_assessor_by_token, 'signed-token', '22')
    expect(result).to eq(session)
    expect(error).to be_nil
  end

  it 'rejects a signed JWT without an authorized tenant membership' do
    allow(TenantMembership).to receive(:active).and_return(TenantMembership)
    allow(TenantMembership).to receive(:find_by).and_return(double(role: 'user'))
    expect(Session).not_to receive(:find_by)

    result, error = middleware.send(:authenticate_assessor_by_token, 'signed-token', '22')
    expect(result).to be_nil
    expect(error).to eq('Authentication failed')
  end
end
