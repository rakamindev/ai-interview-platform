# frozen_string_literal: true

require 'rails_helper'

RSpec.describe CoverageAnalyzerWorker do
  let(:session) { create(:session, tenant_id: 1, status: 'active') }

  it 'does not duplicate a discovered skill across repeated runs' do
    result = { skill_updates: [], discovered_skills: [{ label: 'GraphQL', first_mention: 'used it' }] }
    allow(Coverage::Analyzer).to receive(:new).and_return(instance_double(Coverage::Analyzer, call: result))

    2.times { described_class.new.perform(session.id, 1) }

    expect(session.coverage_maps.where(skill_label: 'GraphQL').count).to eq(1)
  end
end
