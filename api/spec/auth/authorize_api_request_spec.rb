require_relative "../rails_helper"

RSpec.describe AuthorizeApiRequest do
  let(:token) do
    JsonWebToken.encode({ user_id: 7, role: "admin", scheme: "test-corp" })
  end

  it "uses the role from the verified JWT without a local user lookup" do
    expect(User).not_to receive(:find_by)
    result = described_class.new({ "Authorization" => "Bearer #{token}" }, [:assessor]).call

    expect(result[:user].role).to eq("admin")
  end

  it "rejects a signed token missing required identity claims" do
    incomplete_token = JsonWebToken.encode({ user_id: 7, role: "admin" })

    expect do
      described_class.new({ "Authorization" => "Bearer #{incomplete_token}" }).call
    end.to raise_error(ExceptionHandler::InvalidToken)
  end

  it "checks permissions against the verified role claim" do
    user_token = JsonWebToken.encode({ user_id: 7, role: "user", scheme: "test-corp" })

    expect do
      described_class.new({ "Authorization" => "Bearer #{user_token}" }, [:assessor]).call
    end.to raise_error(ExceptionHandler::Unauthorized)
  end

  it "rejects non-Bearer authorization headers" do
    expect do
      described_class.new({ "Authorization" => "Basic #{token}" }).call
    end.to raise_error(ExceptionHandler::MissingToken)
  end
end