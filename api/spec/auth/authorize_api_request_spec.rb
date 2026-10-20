# frozen_string_literal: true

require 'rails_helper'

RSpec.describe AuthorizeApiRequest do
  def headers_for(claims) = { 'Authorization' => "Bearer #{JsonWebToken.encode(claims, 1.hour)}" }

  def authorize(claims, roles) = described_class.new(headers_for(claims), roles).call

  it 'returns the user from the token claims' do
    user = authorize({ user_id: 7, role: 'admin', scheme: 'acme' }, [:assessor])[:user]

    expect([user.id, user.role, user.scheme]).to eq([7, 'admin', 'acme'])
  end

  it "lets both 'admin' and 'assessor' through an :assessor check" do
    expect { authorize({ user_id: 1, role: 'admin' }, [:assessor]) }.not_to raise_error
    expect { authorize({ user_id: 1, role: 'assessor' }, [:assessor]) }.not_to raise_error
  end

  it "refuses any other role on an :assessor check" do
    expect { authorize({ user_id: 1, role: 'user' }, [:assessor]) }.to raise_error(ExceptionHandler::Unauthorized)
    expect { authorize({ user_id: 1 }, [:assessor]) }.to raise_error(ExceptionHandler::Unauthorized)
  end

  it 'lets any role through an :any check, and an exact role through its own check' do
    expect { authorize({ user_id: 1, role: 'user' }, [:any]) }.not_to raise_error
    expect { authorize({ user_id: 1, role: 'user' }, [:user]) }.not_to raise_error
    expect { authorize({ user_id: 1, role: 'user' }, [:admin]) }.to raise_error(ExceptionHandler::Unauthorized)
  end

  it 'refuses a request without an Authorization header' do
    expect { described_class.new({}, [:assessor]).call }.to raise_error(ExceptionHandler::MissingToken)
  end

  it 'refuses an invalid token' do
    expect { described_class.new({ 'Authorization' => 'Bearer nope' }, [:assessor]).call }
      .to raise_error(ExceptionHandler::InvalidToken)
  end
end
