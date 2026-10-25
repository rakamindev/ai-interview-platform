# frozen_string_literal: true

require 'rails_helper'

RSpec.describe JsonWebToken do
  let(:secret) { 'test_secret_key_base_1234567890_test' }
  let(:payload) { { user_id: 42, role: 'user', scheme: 'test-corp' } }

  before do
    allow(ENV).to receive(:fetch).with('SECRET_KEY_BASE').and_return(secret)
  end

  describe '.encode and .decode' do
    it 'encodes payload into JWT and decodes correctly' do
      token = described_class.encode(payload)
      expect(token).to be_a(String)

      decoded = described_class.decode(token)
      expect(decoded[:user_id]).to eq(42)
      expect(decoded[:role]).to eq('user')
      expect(decoded[:scheme]).to eq('test-corp')
      expect(decoded[:exp]).to be_present
    end

    it 'raises ExceptionHandler::InvalidToken when token is tampered' do
      token = described_class.encode(payload)
      tampered = "#{token}tampered"

      expect {
        described_class.decode(tampered)
      }.to raise_error(ExceptionHandler::InvalidToken)
    end

    it 'raises ExceptionHandler::InvalidToken on expired token' do
      expired_token = described_class.encode(payload, -1.minute)

      expect {
        described_class.decode(expired_token)
      }.to raise_error(ExceptionHandler::InvalidToken)
    end
  end

  describe '.decode_without_verification' do
    it 'decodes payload without requiring signature validation' do
      token = described_class.encode(payload)
      decoded = described_class.decode_without_verification(token)

      expect(decoded[:user_id]).to eq(42)
      expect(decoded[:role]).to eq('user')
    end
  end
end
