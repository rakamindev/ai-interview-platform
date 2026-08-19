# frozen_string_literal: true

require 'rails_helper'

RSpec.describe CoverageWebsocketMiddleware do
  let(:app) { ->(_env) { [200, {}, []] } }
  let(:middleware) { described_class.new(app) }
  let(:org) { create(:organization, scheme: 'test-corp') }
  let(:session) { create(:session, tenant_id: org.id) }

  def token(role:)
    JsonWebToken.encode(user_id: 1, role: role, scheme: org.scheme)
  end

  it 'authenticates an assessor (admin) token for the session' do
    result, error = middleware.send(:authenticate_assessor_by_token, token(role: 'admin'), session.id.to_s)

    expect(error).to be_nil
    expect(result).to eq(session)
  end

  it 'rejects a non-assessor (user) token' do
    result, error = middleware.send(:authenticate_assessor_by_token, token(role: 'user'), session.id.to_s)

    expect(result).to be_nil
    expect(error).to eq('Forbidden')
  end
end
