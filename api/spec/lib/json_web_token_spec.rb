# frozen_string_literal: true

require 'rails_helper'

RSpec.describe JsonWebToken do
  it 'round-trips the claims, readable by string or symbol' do
    claims = described_class.decode(described_class.encode({ user_id: 7, role: 'admin', scheme: 'acme' }))

    expect(claims[:user_id]).to eq(7)
    expect(claims['scheme']).to eq('acme')
  end

  it 'adds an expiry when the caller gives none' do
    freeze_time do
      claims = described_class.decode(described_class.encode({ user_id: 1 }, 1.hour))

      expect(claims[:exp]).to eq(1.hour.from_now.to_i)
    end
  end

  it 'keeps an expiry the caller already set' do
    exp = 10.minutes.from_now.to_i

    expect(described_class.decode(described_class.encode({ user_id: 1, exp: })).fetch(:exp)).to eq(exp)
  end

  it 'rejects an expired token' do
    token = described_class.encode({ user_id: 1, exp: 1.minute.ago.to_i })

    expect { described_class.decode(token) }.to raise_error(ExceptionHandler::InvalidToken, /expired/i)
  end

  it 'rejects a token signed with another secret' do
    forged = JWT.encode({ user_id: 1, role: 'admin', exp: 1.hour.from_now.to_i }, 'not-the-secret', 'HS256')

    expect { described_class.decode(forged) }.to raise_error(ExceptionHandler::InvalidToken)
  end

  it "rejects an unsigned token (alg 'none')" do
    unsigned = JWT.encode({ user_id: 1, role: 'admin', exp: 1.hour.from_now.to_i }, nil, 'none')

    expect { described_class.decode(unsigned) }.to raise_error(ExceptionHandler::InvalidToken)
  end

  it 'rejects garbage' do
    expect { described_class.decode('not.a.jwt') }.to raise_error(ExceptionHandler::InvalidToken)
  end
end
