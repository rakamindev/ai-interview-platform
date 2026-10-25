# frozen_string_literal: true

require 'rails_helper'

RSpec.describe JsonWebToken do
  let(:payload) { { user_id: 42, role: 'admin', scheme: 'demo' } }

  describe '.encode and .decode' do
    it 'encodes and decodes a valid JWT payload using SECRET_KEY_BASE' do
      token = described_class.encode(payload.dup)
      decoded = described_class.decode(token)

      expect(decoded[:user_id]).to eq(42)
      expect(decoded[:role]).to eq('admin')
      expect(decoded[:scheme]).to eq('demo')
      expect(decoded[:exp]).to be > Time.zone.now.to_i
    end

    it 'raises ExceptionHandler::InvalidToken when token is tampered with or signed with a different secret' do
      forged_token = JWT.encode(payload, 'wrong_attacker_secret', 'HS256')

      expect {
        described_class.decode(forged_token)
      }.to raise_error(ExceptionHandler::InvalidToken)
    end

    it 'fails fast with KeyError when SECRET_KEY_BASE is missing (no hardcoded fallback)' do
      original_secret = ENV['SECRET_KEY_BASE']
      begin
        ENV.delete('SECRET_KEY_BASE')

        expect {
          described_class.encode(payload.dup)
        }.to raise_error(KeyError)

        expect {
          described_class.decode('any.jwt.token')
        }.to raise_error(KeyError)
      ensure
        ENV['SECRET_KEY_BASE'] = original_secret
      end
    end

    it 'fails fast with KeyError when SECRET_KEY_BASE is blank or whitespace' do
      original_secret = ENV['SECRET_KEY_BASE']
      begin
        ENV['SECRET_KEY_BASE'] = '   '

        expect {
          described_class.encode(payload.dup)
        }.to raise_error(KeyError, /SECRET_KEY_BASE cannot be blank/)
      ensure
        ENV['SECRET_KEY_BASE'] = original_secret
      end
    end
  end
end
