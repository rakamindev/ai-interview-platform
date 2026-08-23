# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Sessions::StartHandler, type: :model do
  let(:session) { create(:session, status: 'pending') }
  let(:assessment) { session.assessment }
  let(:handler) { described_class.new(session) }

  before do
    create_list(:assessment_skill, 2, assessment: assessment)
    allow_any_instance_of(described_class).to receive(:publish_status_update)
  end

  describe '#call' do
    it 'activates the session' do
      handler.call
      expect(session.reload.status).to eq('active')
    end

    it 'sets started_at' do
      handler.call
      expect(session.reload.started_at).to be_present
    end

    it 'initializes coverage maps from assessment skills' do
      handler.call
      expect(session.coverage_maps.count).to eq(2)
    end

    it 'creates coverage maps with correct default state' do
      handler.call
      session.coverage_maps.each do |map|
        expect(map.state).to eq('not_yet')
        expect(map.probe_count).to eq(0)
        expect(map.is_discovered).to be false
      end
    end

    it 'is idempotent — does not create duplicate coverage maps' do
      handler.call
      handler.call
      expect(session.coverage_maps.count).to eq(2)
    end

    it 'returns the session' do
      result = handler.call
      expect(result).to eq(session)
    end
  end
end
