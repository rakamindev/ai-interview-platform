# frozen_string_literal: true

require 'rails_helper'

RSpec.describe AuthorizeApiRequest do
  let(:secret) { 'test-secret-key' }

  before do
    allow(ENV).to receive(:fetch).and_call_original
    allow(ENV).to receive(:fetch).with('SECRET_KEY_BASE').and_return(secret)
  end

  def authorization_for(role:, user_id: 123, scheme: 'tenant-a')
    token = JsonWebToken.encode(user_id: user_id, role: role, scheme: scheme)
    { 'Authorization' => "Bearer #{token}" }
  end

  it 'accepts an authenticated admin for assessor-protected operations' do
    result = described_class.new(authorization_for(role: 'admin'), [:assessor]).call

    expect(result[:user].role).to eq('admin')
    expect(result[:user].id).to eq(123)
  end

  it 'accepts assessor, recruiter and hr_manager for assessor permission' do
    %w[assessor recruiter hr_manager].each do |role|
      expect { described_class.new(authorization_for(role: role), [:assessor]).call }.not_to raise_error
    end
  end

  it 'rejects a regular user for assessor-protected operations' do
    expect do
      described_class.new(authorization_for(role: 'user'), [:assessor]).call
    end.to raise_error(ExceptionHandler::Unauthorized)
  end

  it 'rejects requests without a bearer token' do
    expect { described_class.new({}, [:any]).call }.to raise_error(ExceptionHandler::MissingToken)
  end

  it 'rejects malformed tokens' do
    expect do
      described_class.new({ 'Authorization' => 'Bearer not-a-jwt' }, [:any]).call
    end.to raise_error(ExceptionHandler::InvalidToken)
  end
end
