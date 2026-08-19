require 'rails_helper'

RSpec.describe JsonWebToken do
  let(:payload) { { user_id: 1, role: 'admin' } }
  let(:secret) { ENV.fetch('SECRET_KEY_BASE') }

  describe '.encode' do
    it 'encodes a payload with expiration' do
      token = described_class.encode(payload)
      decoded = JWT.decode(token, secret, true, { algorithms: ['HS256'] })[0]
      expect(decoded['user_id']).to eq(1)
      expect(decoded['exp']).to be_present
    end

    it 'allows custom expiration time' do
      expiration = 1.hour.from_now.to_i
      token = described_class.encode(payload, 1.hour)
      decoded = JWT.decode(token, secret, true, { algorithms: ['HS256'] })[0]
      expect(decoded['exp']).to be_within(5).of(expiration)
    end
  end

  describe '.decode' do
    let(:token) { described_class.encode(payload) }

    it 'decodes a valid token' do
      decoded = described_class.decode(token)
      expect(decoded[:user_id]).to eq(1)
      expect(decoded[:role]).to eq('admin')
    end

    it 'raises InvalidToken for expired tokens' do
      expired_token = described_class.encode(payload, -1.hour)
      expect { described_class.decode(expired_token) }
        .to raise_error(ExceptionHandler::InvalidToken, /Signature has expired/)
    end

    it 'raises InvalidToken for malformed tokens' do
      expect { described_class.decode('invalid.token.here') }
        .to raise_error(ExceptionHandler::InvalidToken)
    end
  end

  describe '.decode_without_verification' do
    let(:token) { described_class.encode(payload) }

    it 'decodes a token without verifying signature' do
      decoded = described_class.decode_without_verification(token)
      expect(decoded[:user_id]).to eq(1)
    end

    it 'decodes an expired token' do
      expired_token = described_class.encode(payload, -1.hour)
      decoded = described_class.decode_without_verification(expired_token)
      expect(decoded[:user_id]).to eq(1)
    end

    it 'raises InvalidToken for malformed tokens' do
      expect { described_class.decode_without_verification('invalid.token.here') }
        .to raise_error(ExceptionHandler::InvalidToken)
    end
  end
end
