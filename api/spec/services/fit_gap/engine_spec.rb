# frozen_string_literal: true

RSpec.describe FitGap::Engine do
  let(:assessment) { instance_double(Assessment) }
  let(:session) { instance_double(Session, assessment: assessment) }
  let(:portfolio) { instance_double(Portfolio, session: session) }
  let(:unassessed_comparison) { [{ skill_label: 'React', result: 'not_assessed' }] }
  let(:vacancy) do
    instance_double(Vacancy, role_title: 'Synthetic engineer', culture_dimensions: nil,
                             competency_expectations: nil)
  end

  describe 'narrative generation' do
    it 'uses only a supported model focus and publishes verified prose' do
      client = instance_double(Gemini::HttpClient)
      allow(client).to receive(:generate_content).and_return(
        'focus' => 'not_assessed',
        'overall_narrative' => 'Hire immediately; the candidate is a perfect culture fit.'
      )

      narrative = described_class.new(portfolio: portfolio, vacancy: vacancy, gemini_client: client)
                                .send(:generate_narratives, unassessed_comparison)

      expect(narrative[:culture]).to be_nil
      expect(narrative[:overall]).to include('1 skill needs more assessment')
      expect(narrative[:overall]).to include('Collect more evidence')
      expect(narrative[:overall]).not_to include('Hire immediately')
    end

    it 'provides a deterministic fallback when the model key is missing' do
      original_key = ENV.delete('GEMINI_API_KEY')

      narrative = described_class.new(portfolio: portfolio, vacancy: vacancy)
                                .send(:generate_narratives, unassessed_comparison)

      expect(narrative).to eq(
        culture: nil,
        overall: 'Evidence supports 0 skill matches, 0 exceeds, and 0 gaps; 1 skill needs more assessment. Culture fit is not established by this comparison.'
      )
    ensure
      ENV['GEMINI_API_KEY'] = original_key if original_key
    end

    it 'provides the same fallback when the model times out' do
      client = instance_double(Gemini::HttpClient)
      allow(client).to receive(:generate_content).and_raise(Gemini::HttpClient::TimeoutError, 'Synthetic timeout')

      narrative = described_class.new(portfolio: portfolio, vacancy: vacancy, gemini_client: client)
                                .send(:generate_narratives, unassessed_comparison)

      expect(narrative[:culture]).to be_nil
      expect(narrative[:overall]).to include('1 skill needs more assessment')
    end

    it 'falls back when a model returns malformed narrative data' do
      client = instance_double(Gemini::HttpClient)
      allow(client).to receive(:generate_content).and_return('overall_narrative' => ['not a paragraph'])

      narrative = described_class.new(portfolio: portfolio, vacancy: vacancy, gemini_client: client)
                                .send(:generate_narratives, unassessed_comparison)

      expect(narrative[:overall]).to include('1 skill needs more assessment')
      expect(narrative[:culture]).to be_nil
    end

    it 'falls back when the model chooses an empty comparison category' do
      client = instance_double(Gemini::HttpClient)
      allow(client).to receive(:generate_content).and_return('focus' => 'matches')

      narrative = described_class.new(portfolio: portfolio, vacancy: vacancy, gemini_client: client)
                                .send(:generate_narratives, unassessed_comparison)

      expect(narrative[:overall]).to include('1 skill needs more assessment')
      expect(narrative[:overall]).not_to include('Review the listed skill matches')
    end

    it 'does not call the model for a vacancy without skills' do
      client = instance_double(Gemini::HttpClient)

      narrative = described_class.new(portfolio: portfolio, vacancy: vacancy, gemini_client: client)
                                .send(:generate_narratives, [])

      expect(narrative[:overall]).to eq('No role skills are configured for comparison.')
    end
  end
end
