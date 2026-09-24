# frozen_string_literal: true

require_relative '../spec_helper'

class JsonWebToken
  def self.decode(_token)
    { user_id: 4, role: 'admin', scheme: 'tenant-a' }
  end
end

class User
  def self.find_by(**); end
end

class Organization
  def self.find_by(**); end
end

class TenantMembership
  def self.active = self
  def self.find_by(**); end
end

require_relative '../../app/auth/authorize_api_request'

RSpec.describe AuthorizeApiRequest do
  let(:user) { double(id: 4) }
  let(:organization) { double(id: 9, scheme: 'tenant-a') }
  let(:membership) { double(role: 'assessor', organization:) }
  let(:headers) { { 'Authorization' => 'Bearer signed-token' } }

  before do
    allow(User).to receive(:find_by).with(id: 4).and_return(user)
    allow(Organization).to receive(:find_by).with(scheme: 'tenant-a').and_return(organization)
    allow(TenantMembership).to receive(:find_by).with(user_id: 4, organization_id: 9).and_return(membership)
  end

  it 'uses persisted membership role rather than the JWT role claim' do
    result = described_class.new(headers, :assessor).call
    expect(result[:user].role).to eq('assessor')
    expect(result[:organization]).to eq(organization)
  end

  it 'rejects a request tenant selector that differs from the signed context' do
    headers['X-Tenant-Scheme'] = 'tenant-b'
    expect { described_class.new(headers).call }.to raise_error(ExceptionHandler::Unauthorized)
  end

  it 'rejects a user with no active membership for the signed tenant' do
    allow(TenantMembership).to receive(:find_by).and_return(nil)
    expect { described_class.new(headers).call }.to raise_error(ExceptionHandler::Unauthorized)
  end
end
