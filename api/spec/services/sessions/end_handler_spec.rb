require 'rails_helper'

RSpec.describe Sessions::EndHandler do
  let(:assessment) { create(:assessment) }
  let(:session_obj) { create(:session, assessment: assessment, status: 'active', started_at: 10.minutes.ago) }

  before do
    stub_const('PortfolioGeneratorWorker', Class.new do
      def self.perform_async(*args); true; end
    end)
    allow(PortfolioGeneratorWorker).to receive(:perform_async).and_return(true)
    
    # Mock Redis to avoid connection errors in tests
    mock_redis = double('Redis')
    allow(::Redis).to receive(:new).and_return(mock_redis)
    allow(mock_redis).to receive(:publish).and_return(true)
    allow(mock_redis).to receive(:close)
  end

  describe '#call' do
    context 'Positive Cases' do
      it 'ends an active session successfully and creates a portfolio' do
        handler = described_class.new(session_obj)
        expect { handler.call(reason: 'all_covered') }.to change { session_obj.reload.status }.from('active').to('ended')
        
        expect(session_obj.end_reason).to eq('all_covered')
        expect(session_obj.portfolio).to be_present
        expect(PortfolioGeneratorWorker).to have_received(:perform_async).with(session_obj.id)
      end

      it 'allows upgrading an error end reason to manual_candidate' do
        error_session = create(:session, assessment: assessment, status: 'ended', end_reason: 'error')
        handler = described_class.new(error_session)
        handler.call(reason: 'manual_candidate')
        expect(error_session.reload.end_reason).to eq('manual_candidate')
      end
    end

    context 'Negative Cases' do
      it 'defaults to manual_assessor if an invalid reason is provided' do
        handler = described_class.new(session_obj)
        handler.call(reason: 'invalid_reason')
        expect(session_obj.reload.end_reason).to eq('manual_assessor')
      end

      it 'is idempotent and does not create an additional portfolio if already present' do
        session_obj.create_portfolio(candidate_id: 1, generation_status: 'pending')
        expect {
          described_class.new(session_obj).call(reason: 'all_covered')
        }.not_to change(Portfolio, :count)
      end
    end
  end
end
