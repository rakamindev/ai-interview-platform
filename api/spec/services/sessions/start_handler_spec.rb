require 'rails_helper'

RSpec.describe Sessions::StartHandler do
  let(:assessment) { create(:assessment) }
  let(:session_obj) { create(:session, assessment: assessment, status: 'pending') }

  before do
    # Create Assessment Skills for the assessment to test map generation
    assessment.assessment_skills.create!(
      skill_label: 'Node.js', 
      expected_level: 3, 
      l1_anchor: 'A', l2_anchor: 'B', l3_anchor: 'C', l4_anchor: 'D', l5_anchor: 'E'
    )

    assessment.assessment_skills.create!(
      skill_label: 'React', 
      expected_level: 4,
      l1_anchor: 'A', l2_anchor: 'B', l3_anchor: 'C', l4_anchor: 'D', l5_anchor: 'E'
    )

    mock_redis = double('Redis')
    allow(::Redis).to receive(:new).and_return(mock_redis)
    allow(mock_redis).to receive(:publish).and_return(true)
    allow(mock_redis).to receive(:close)
  end

  describe '#call' do
    it 'activates a pending session successfully' do
      handler = described_class.new(session_obj)
      
      expect { handler.call }.to change { session_obj.reload.status }.from('pending').to('active')
      expect(session_obj.started_at).to be_present
    end

    it 'initializes coverage maps according to assessment skills' do
      handler = described_class.new(session_obj)
      expect { handler.call }.to change(CoverageMap, :count).by(2)
      
      labels = session_obj.coverage_maps.pluck(:skill_label)
      expect(labels).to include('Node.js', 'React')
      expect(session_obj.coverage_maps.first.state).to eq('not_yet')
    end

    it 'is idempotent and does not recreate coverage maps if they exist' do
      handler = described_class.new(session_obj)
      handler.call
      
      # Try calling again
      expect { handler.call }.not_to change(CoverageMap, :count)
    end
  end
end
