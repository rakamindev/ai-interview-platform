# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Sessions::StartHandler do
  let(:assessment) { create(:assessment) }
  let(:session) { create(:session, assessment: assessment, status: 'pending') }
  let(:handler) { described_class.new(session) }

  before do
    allow(::Redis).to receive(:new).and_return(instance_double(::Redis, publish: true, close: true))
  end

  describe '#call' do
    let!(:skill1) { create(:assessment_skill, assessment: assessment, skill_id: 's1', skill_label: 'Ruby', display_order: 1) }
    let!(:skill2) { create(:assessment_skill, assessment: assessment, skill_id: 's2', skill_label: 'Rails', display_order: 2) }

    it 'activates the session' do
      expect { handler.call }.to change { session.reload.status }.from('pending').to('active')
      expect(session.started_at).to be_present
    end

    it 'initializes coverage maps for assessment skills' do
      expect { handler.call }.to change(CoverageMap, :count).by(2)
      
      maps = session.coverage_maps.order(:id)
      expect(maps.first.skill_id).to eq('s1')
      expect(maps.first.skill_label).to eq('Ruby')
      expect(maps.first.state).to eq('not_yet')
      
      expect(maps.last.skill_id).to eq('s2')
    end

    it 'is idempotent and does not recreate coverage maps if they exist' do
      create(:coverage_map, session: session, skill_id: 's1', skill_label: 'Ruby')
      
      expect { handler.call }.not_to change(CoverageMap, :count)
    end

    it 'publishes status update to redis' do
      redis_double = instance_double(::Redis)
      allow(::Redis).to receive(:new).and_return(redis_double)
      expect(redis_double).to receive(:publish).with("coverage:#{session.id}", anything)
      expect(redis_double).to receive(:close)
      
      handler.call
    end

    context 'when redis fails' do
      it 'rescues the error and still activates the session' do
        redis_double = instance_double(::Redis)
        allow(::Redis).to receive(:new).and_return(redis_double)
        allow(redis_double).to receive(:publish).and_raise(StandardError, 'Redis offline')
        expect(redis_double).to receive(:close)

        expect { handler.call }.not_to raise_error
        expect(session.reload.status).to eq('active')
      end
    end
  end
end
