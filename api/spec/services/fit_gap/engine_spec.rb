# frozen_string_literal: true

require 'rails_helper'

RSpec.describe FitGap::Engine, type: :service do
  let(:organization) { create(:organization) }
  let(:user) { create(:user) }
  let(:assessment) { create(:assessment, tenant_id: organization.id, created_by: user.id) }
  let(:session) { create(:session, tenant_id: organization.id, assessment: assessment) }
  let(:portfolio) { create(:portfolio, session: session) }
  let(:vacancy) do
    create(
      :vacancy,
      tenant_id: organization.id,
      created_by: user.id,
      role_title: 'Senior Backend Engineer',
      culture_dimensions: 'Collaborative, high ownership',
      competency_expectations: 'Strong in API design and database modeling'
    )
  end

  let(:gemini_client) { instance_double(Gemini::HttpClient) }

  subject(:engine) do
    described_class.new(
      portfolio: portfolio,
      vacancy: vacancy,
      gemini_client: gemini_client
    )
  end

  let(:gemini_success_response) do
    {
      'culture_narrative' => 'Candidate exhibits strong ownership and collaborative mindset.',
      'overall_narrative' => 'Strong recommendation for Senior Backend Engineer role.'
    }.to_json
  end

  before do
    allow(gemini_client).to receive(:generate_content).and_return(gemini_success_response)
  end

  describe '#call' do
    context 'basic report lifecycle' do
      let!(:v_skill) do
        create(:vacancy_skill, vacancy: vacancy, skill_label: 'Ruby on Rails', expected_level: 3)
      end

      let!(:p_skill) do
        create(:portfolio_skill, portfolio: portfolio, skill_label: 'Ruby on Rails', ai_level: 3)
      end

      it 'creates a new FitGapReport when none exists' do
        expect do
          report = engine.call
          expect(report).to be_a(FitGapReport)
          expect(report).to be_persisted
          expect(report.portfolio_id).to eq(portfolio.id)
          expect(report.vacancy_id).to eq(vacancy.id)
          expect(report.culture_narrative).to eq('Candidate exhibits strong ownership and collaborative mindset.')
          expect(report.overall_narrative).to eq('Strong recommendation for Senior Backend Engineer role.')
          expect(report.generated_at).to be_present
        end.to change(FitGapReport, :count).by(1)
      end

      it 'updates an existing FitGapReport if one already exists' do
        existing_report = create(
          :fit_gap_report,
          portfolio: portfolio,
          vacancy: vacancy,
          skill_comparisons: [{ skill_label: 'Old', expected_level: 1, candidate_level: 1, result: 'match', delta: 0 }],
          culture_narrative: 'Old narrative',
          overall_narrative: 'Old overall'
        )

        expect do
          report = engine.call
          expect(report.id).to eq(existing_report.id)
          expect(report.culture_narrative).to eq('Candidate exhibits strong ownership and collaborative mindset.')
        end.not_to change(FitGapReport, :count)
      end
    end

    context 'skill comparisons matrix' do
      let!(:v_match) do
        create(:vacancy_skill, vacancy: vacancy, skill_id: 'ruby_1', skill_label: 'Ruby', expected_level: 3)
      end
      let!(:v_gap) do
        create(:vacancy_skill, vacancy: vacancy, skill_id: 'sql_1', skill_label: 'SQL', expected_level: 4)
      end
      let!(:v_exceed) do
        create(:vacancy_skill, vacancy: vacancy, skill_id: 'api_1', skill_label: 'REST API', expected_level: 2)
      end
      let!(:v_not_assessed) do
        create(:vacancy_skill, vacancy: vacancy, skill_id: 'k8s_1', skill_label: 'Kubernetes', expected_level: 3)
      end

      let!(:p_match) do
        create(:portfolio_skill, portfolio: portfolio, skill_id: 'ruby_1', skill_label: 'Ruby', ai_level: 3,
                                 ai_confidence: 'high')
      end
      let!(:p_gap) do
        create(:portfolio_skill, portfolio: portfolio, skill_id: 'sql_1', skill_label: 'SQL', ai_level: 2,
                                 ai_confidence: 'medium')
      end
      let!(:p_exceed) do
        create(:portfolio_skill, portfolio: portfolio, skill_id: 'api_1', skill_label: 'REST API', ai_level: 4,
                                 ai_confidence: 'high')
      end

      it 'correctly categorizes match, gap, exceed, and not_assessed' do
        report = engine.call
        comparisons = report.skill_comparisons.index_by { |c| c['skill_label'] }

        # Match check
        expect(comparisons['Ruby']).to include(
          'candidate_level' => 3,
          'expected_level' => 3,
          'result' => 'match',
          'delta' => 0,
          'confidence' => 'high'
        )

        # Gap check
        expect(comparisons['SQL']).to include(
          'candidate_level' => 2,
          'expected_level' => 4,
          'result' => 'gap',
          'delta' => -2,
          'confidence' => 'medium'
        )

        # Exceed check
        expect(comparisons['REST API']).to include(
          'candidate_level' => 4,
          'expected_level' => 2,
          'result' => 'exceed',
          'delta' => 2,
          'confidence' => 'high'
        )

        # Not assessed check
        expect(comparisons['Kubernetes']).to include(
          'candidate_level' => nil,
          'expected_level' => 3,
          'result' => 'not_assessed',
          'delta' => nil,
          'confidence' => nil
        )
      end
    end

    context 'assessor overrides' do
      let!(:vacancy_skill) do
        create(:vacancy_skill, vacancy: vacancy, skill_id: 'sys_1', skill_label: 'System Design', expected_level: 4)
      end
      let!(:portfolio_skill) do
        create(:portfolio_skill, portfolio: portfolio, skill_id: 'sys_1', skill_label: 'System Design', ai_level: 2)
      end

      it 'uses the assessor override level instead of the ai level' do
        create(
          :assessor_override,
          portfolio_skill: portfolio_skill,
          ai_level: 2,
          override_level: 4,
          overridden_by: user.id
        )

        report = engine.call
        comparison = report.skill_comparisons.first

        expect(comparison['candidate_level']).to eq(4)
        expect(comparison['expected_level']).to eq(4)
        expect(comparison['delta']).to eq(0)
        expect(comparison['result']).to eq('match')
      end
    end

    context 'skill matching strategy' do
      it 'matches by skill_id priority when labels differ' do
        create(:vacancy_skill, vacancy: vacancy, skill_id: 'sec_1', skill_label: 'App Security', expected_level: 3)
        create(:portfolio_skill, portfolio: portfolio, skill_id: 'sec_1', skill_label: 'Application Security',
                                 ai_level: 3)

        report = engine.call
        comparison = report.skill_comparisons.first

        expect(comparison['skill_label']).to eq('App Security')
        expect(comparison['candidate_level']).to eq(3)
        expect(comparison['result']).to eq('match')
      end

      it 'matches case-insensitively by skill_label when skill_id is missing' do
        create(:vacancy_skill, vacancy: vacancy, skill_id: nil, skill_label: 'PostgreSQL', expected_level: 3)
        create(:portfolio_skill, portfolio: portfolio, skill_id: nil, skill_label: 'postgresql', ai_level: 3)

        report = engine.call
        comparison = report.skill_comparisons.first

        expect(comparison['candidate_level']).to eq(3)
        expect(comparison['result']).to eq('match')
      end
    end

    context 'narrative generation and fault-tolerance' do
      let!(:vacancy_skill) do
        create(:vacancy_skill, vacancy: vacancy, skill_label: 'Architecture', expected_level: 3)
      end
      let!(:portfolio_skill) do
        create(:portfolio_skill, portfolio: portfolio, skill_label: 'Architecture', ai_level: 3)
      end

      it 'calls Gemini with prompt containing role title and expectations' do
        expect(gemini_client).to receive(:generate_content).with(
          satisfy { |prompt|
            prompt.include?('Senior Backend Engineer') &&
              prompt.include?('Collaborative, high ownership') &&
              prompt.include?('Strong in API design and database modeling')
          },
          temperature: 0.4
        ).and_return(gemini_success_response)

        engine.call
      end

      it 'falls back gracefully to rule-based summary when Gemini API raises an error' do
        allow(gemini_client).to receive(:generate_content)
          .and_raise(Faraday::ConnectionFailed.new('Connection timeout'))

        report = engine.call

        expect(report.culture_narrative).to be_nil
        expect(report.overall_narrative).to eq(
          'Candidate shows 1 skill matches, 0 exceeds, and 0 gaps against role requirements.'
        )
      end

      it 'falls back gracefully when Gemini returns invalid non-JSON format' do
        allow(gemini_client).to receive(:generate_content).and_return('Quota Exceeded')

        report = engine.call

        expect(report.culture_narrative).to be_nil
        expect(report.overall_narrative).to eq(
          'Candidate shows 1 skill matches, 0 exceeds, and 0 gaps against role requirements.'
        )
      end
    end
  end
end
