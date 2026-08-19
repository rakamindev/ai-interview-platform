# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Sessions::EndHandler do
  let(:session) { create(:session, tenant_id: 1, status: 'active', started_at: 1.minute.ago) }

  it 'ends the session and creates exactly one portfolio' do
    described_class.new(session).call(reason: 'manual_assessor')

    expect(session.reload.status).to eq('ended')
    expect(Portfolio.where(session_id: session.id).count).to eq(1)
  end

  it 'is idempotent when called twice — no duplicate portfolio, no error (P3-5)' do
    described_class.new(session).call(reason: 'all_covered')

    expect { described_class.new(session.reload).call(reason: 'manual_assessor') }.not_to raise_error
    expect(Portfolio.where(session_id: session.id).count).to eq(1)
  end
end
