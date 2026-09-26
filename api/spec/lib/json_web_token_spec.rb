# frozen_string_literal: true

require "rails_helper"

RSpec.describe JsonWebToken do
  it "round-trips a signed token" do
    token = described_class.encode(user_id: 1, role: "admin", scheme: "x")

    expect(described_class.decode(token)[:user_id]).to eq(1)
  end

  it "rejects a token with no expiry (a leaked one would be valid forever)" do
    token = JWT.encode({ user_id: 1, role: "admin", scheme: "x" }, ENV.fetch("SECRET_KEY_BASE"), "HS256")

    expect { described_class.decode(token) }.to raise_error(ExceptionHandler::InvalidToken)
  end

  it "rejects an expired token" do
    token = described_class.encode({ user_id: 1, exp: 1.minute.ago.to_i })

    expect { described_class.decode(token) }.to raise_error(ExceptionHandler::InvalidToken)
  end

  it "rejects a token signed with a different secret" do
    token = JWT.encode({ user_id: 1, exp: 1.hour.from_now.to_i }, "other-secret", "HS256")

    expect { described_class.decode(token) }.to raise_error(ExceptionHandler::InvalidToken)
  end

  it "rejects alg=none" do
    token = JWT.encode({ user_id: 1, exp: 1.hour.from_now.to_i }, nil, "none")

    expect { described_class.decode(token) }.to raise_error(ExceptionHandler::InvalidToken)
  end
end
