require 'rails_helper'

RSpec.describe FitGap::Engine, type: :service do
  let(:organization) { create(:organization) }
  let(:vacancy) { create(:vacancy, tenant_id: organization.id) }
  let(:session) { create(:session, tenant_id: organization.id) }
  let(:portfolio) { create(:portfolio, session: session) }
  let!(:vacancy_skill) { create(:vacancy_skill, vacancy: vacancy, skill_label: "Ruby") }
  let(:gemini_client_mock) { instance_double("Gemini::HttpClient") }

  describe '#call' do
    context '[SEEDED FAULT] when Gemini API times out' do
      before do
        # Mock Gemini client to force a timeout error
        allow(gemini_client_mock).to receive(:generate_content)
          .and_raise(StandardError, "Gemini API Timeout: execution expired")
        
        # Intercept logs to test for data leakage
        @log_output = StringIO.new
        @original_logger = Rails.logger
        Rails.logger = Logger.new(@log_output)
      end

      after do
        Rails.logger = @original_logger
      end

      it 'uses fallback narrative without crashing' do
        engine = described_class.new(
          portfolio: portfolio, 
          vacancy: vacancy, 
          gemini_client: gemini_client_mock
        )
        
        expect { engine.call }.not_to raise_error

        report = FitGapReport.find_by(portfolio_id: portfolio.id, vacancy_id: vacancy.id)
        expect(report).to be_present
        expect(report.culture_narrative).to be_nil
        expect(report.overall_narrative).to match(/Candidate shows \d+ skill matches/)
      end

      it 'does not leak candidate PII or API key in logs' do
        engine = described_class.new(
          portfolio: portfolio, 
          vacancy: vacancy, 
          gemini_client: gemini_client_mock
        )
        engine.call

        log_contents = @log_output.string
        
        expect(log_contents).to include("[N13] Narrative generation failed")
        
        api_key = ENV.fetch('GEMINI_API_KEY', 'dummy_api_key')
        expect(log_contents).not_to include(api_key) if api_key.present?
        
        expect(log_contents).not_to include(session.candidate_name) if session.candidate_name.present?
        expect(log_contents).not_to include(session.candidate_id.to_s) if session.candidate_id.present?
      end
    end
    
    context '[SEEDED FAULT] expected_level integrity' do
      it 'produces correct expected_level values in skill comparisons' do
        engine = described_class.new(
          portfolio: portfolio,
          vacancy: vacancy,
          gemini_client: gemini_client_mock
        )

        allow(gemini_client_mock).to receive(:generate_content)
          .and_raise(StandardError, "Gemini API Timeout")

        engine.call

        report = FitGapReport.find_by(portfolio_id: portfolio.id, vacancy_id: vacancy.id)
        comparisons = report.skill_comparisons

        comparisons.each do |comp|
          # expected_level HARUS antara 1-5 (sesuai constraint DB)
          expect(comp['expected_level']).to be_between(1, 5),
            "expected_level #{comp['expected_level']} for skill '#{comp['skill_label']}' is out of valid range 1..5"
        end
      end
    end
  end
end
