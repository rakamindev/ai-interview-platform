# frozen_string_literal: true

require 'rails_helper'

RSpec.describe JsonWebToken do
  let(:payload) { { user_id: 42, role: 'admin', scheme: 'test-corp' } }

  describe '.encode and .decode' do
    it 'successfully encodes and decodes a payload' do
      token = described_class.encode(payload)
      expect(token).to be_a(String)

      decoded = described_class.decode(token)
      expect(decoded[:user_id]).to eq(42)
      expect(decoded[:role]).to eq('admin')
      expect(decoded[:scheme]).to eq('test-corp')
      expect(decoded[:exp]).to be_present
    end

    it 'raises InvalidToken error when decoding an invalid or tampered token' do
      invalid_token = 'invalid.jwt.token'
      expect {
        described_class.decode(invalid_token)
      }.to raise_error(ExceptionHandler::InvalidToken)
    end

    it 'raises InvalidToken error when token is expired' do
      # Encode with expiration in the past (-10 seconds)
      token = described_class.encode(payload, -10)
      expect {
        described_class.decode(token)
      }.to raise_error(ExceptionHandler::InvalidToken)
    end
  end
end
