# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Sessions::StartHandler do
  let(:session) { create(:session) }
  let(:redis) { instance_double(Redis, publish: 1, close: nil) }

  before do
    allow(Redis).to receive(:new).and_return(redis)
  end

  it 'activates a pending session and initializes coverage maps in display order' do
    create(:assessment_skill, assessment: session.assessment, skill_id: 'ruby', skill_label: 'Ruby', display_order: 2)
    create(:assessment_skill, assessment: session.assessment, skill_id: 'sql', skill_label: 'SQL', display_order: 1)

    described_class.new(session).call

    expect(session.reload).to be_active
    expect(session.started_at).to be_present
    expect(session.coverage_maps.order(:id).pluck(:skill_label)).to contain_exactly('Ruby', 'SQL')
    expect(session.coverage_maps.pluck(:state).uniq).to eq(['not_yet'])
  end

  it 'does not duplicate coverage maps when called more than once' do
    create(:assessment_skill, assessment: session.assessment, skill_label: 'Ruby', skill_id: 'ruby')

    described_class.new(session).call
    first_count = session.coverage_maps.count

    described_class.new(session).call

    expect(session.coverage_maps.count).to eq(first_count)
  end

  it 'still returns the session if Redis status publishing fails' do
    allow(redis).to receive(:publish).and_raise(Redis::BaseError, 'redis unavailable')

    expect(described_class.new(session).call).to eq(session)
    expect(session.reload).to be_active
  end
end
