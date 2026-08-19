# frozen_string_literal: true

require 'rails_helper'

RSpec.describe JsonWebToken do
  it 'round-trips claims' do
    token = described_class.encode(user_id: 7, role: 'admin', scheme: 'acme')
    claims = described_class.decode(token)

    expect(claims[:user_id]).to eq(7)
    expect(claims[:role]).to eq('admin')
    expect(claims[:scheme]).to eq('acme')
  end

  it 'sets an expiry when none is provided' do
    token = described_class.encode(user_id: 1)
    expect(described_class.decode(token)[:exp]).to be_present
  end

  it 'rejects a malformed token' do
    expect { described_class.decode('not.a.jwt') }.to raise_error(ExceptionHandler::InvalidToken)
  end

  it 'rejects an expired token' do
    token = described_class.encode(user_id: 1, exp: Time.now.to_i - 10)
    expect { described_class.decode(token) }.to raise_error(ExceptionHandler::InvalidToken)
  end
end
