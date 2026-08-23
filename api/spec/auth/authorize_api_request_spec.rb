# frozen_string_literal: true

require 'rails_helper'

RSpec.describe AuthorizeApiRequest, type: :model do
  let(:user_id) { 1 }
  let(:role) { 'admin' }
  let(:scheme) { 'test-corp' }
  let(:token) { JsonWebToken.encode(user_id: user_id, role: role, scheme: scheme) }
  let(:headers) { { 'Authorization' => "Bearer #{token}" } }

  describe '#call' do
    context 'with valid token' do
      it 'returns user struct with correct attributes' do
        result = described_class.new(headers).call
        expect(result[:user].id).to eq(user_id)
        expect(result[:user].role).to eq(role)
        expect(result[:user].scheme).to eq(scheme)
      end

      it 'returns claims' do
        result = described_class.new(headers).call
        expect(result[:claims]).to be_present
      end
    end

    context 'with missing token' do
      it 'raises MissingToken error' do
        expect {
          described_class.new({}).call
        }.to raise_error(ExceptionHandler::MissingToken)
      end
    end

    context 'with invalid token' do
      it 'raises InvalidToken error' do
        headers = { 'Authorization' => 'Bearer invalid_token' }
        expect {
          described_class.new(headers).call
        }.to raise_error(ExceptionHandler::InvalidToken)
      end
    end

    context 'with expired token' do
      it 'raises InvalidToken error' do
        expired_token = JsonWebToken.encode(user_id: user_id, role: role, scheme: scheme, exp: 1.day.ago.to_i)
        headers = { 'Authorization' => "Bearer #{expired_token}" }
        expect {
          described_class.new(headers).call
        }.to raise_error(ExceptionHandler::InvalidToken)
      end
    end
  end

  describe 'role checking' do
    context 'with required role matching' do
      it 'allows access when role matches' do
        result = described_class.new(headers, ['admin']).call
        expect(result[:user].role).to eq('admin')
      end
    end

    context 'with required role not matching' do
      it 'raises Unauthorized error' do
        expect {
          described_class.new(headers, ['user']).call
        }.to raise_error(ExceptionHandler::Unauthorized)
      end
    end

    context 'with assessor role check' do
      it 'allows admin role when assessor is required' do
        result = described_class.new(headers, ['assessor']).call
        expect(result[:user].role).to eq('admin')
      end

      it 'allows assessor role when assessor is required' do
        token = JsonWebToken.encode(user_id: 2, role: 'assessor', scheme: scheme)
        headers = { 'Authorization' => "Bearer #{token}" }
        result = described_class.new(headers, ['assessor']).call
        expect(result[:user].role).to eq('assessor')
      end
    end

    context 'with any role check' do
      it 'allows any role' do
        result = described_class.new(headers, ['any']).call
        expect(result[:user]).to be_present
      end
    end
  end

  describe 'constants' do
    it 'defines ASSESSOR_ROLES' do
      expect(described_class::ASSESSOR_ROLES).to eq(%w[admin assessor])
    end
  end
end
