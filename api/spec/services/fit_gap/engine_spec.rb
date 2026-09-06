# frozen_string_literal: true

require 'rails_helper'

RSpec.describe FitGap::Engine do
  let(:org)        { create_org!(name: 'Test Org', scheme: 'test-corp') }
  let(:assessment) { create(:assessment, tenant_id: org.id) }
  let(:session)    { create(:session, assessment: assessment) }
  let(:portfolio)  { create(:portfolio, session: session, tenant_id: org.id) }

  describe '#build_skill_comparisons' do
    context 'when portfolio has a not_assessed skill (ai_level nil, not_assessed true)' do
      before do
        create(:portfolio_skill, :not_assessed,
               portfolio: portfolio, skill_label: 'System Design', skill_id: 'SK-SD-001')
      end

      it "returns result 'not_assessed' (NOT 'gap' — candidate is not penalized for unprobed skill)" do
        vacancy = create(:vacancy, tenant_id: org.id)
        vacancy.vacancy_skills.create!(
          skill_label: 'System Design',
          skill_id: 'SK-SD-001',
          expected_level: 3
        )
        engine = described_class.new(portfolio: portfolio, vacancy: vacancy)
        comparisons = engine.build_skill_comparisons

        result = comparisons.find { |c| c[:skill_label] == 'System Design' }
        expect(result).to be_present
        expect(result[:result]).to eq('not_assessed')
        expect(result[:candidate_level]).to be_nil
        expect(result[:delta]).to be_nil
      end
    end

    context 'when vacancy requires a skill completely missing from portfolio' do
      it "returns result 'not_assessed'" do
        vacancy = create(:vacancy, tenant_id: org.id)
        vacancy.vacancy_skills.create!(
          skill_label: 'Docker & Kubernetes',
          skill_id: 'SK-OPS-001',
          expected_level: 3
        )
        engine = described_class.new(portfolio: portfolio, vacancy: vacancy)
        comparisons = engine.build_skill_comparisons

        result = comparisons.find { |c| c[:skill_label] == 'Docker & Kubernetes' }
        expect(result).to be_present
        expect(result[:result]).to eq('not_assessed')
        expect(result[:candidate_level]).to be_nil
      end
    end

    context 'when portfolio has an assessor override' do
      before do
        create(:portfolio_skill, :with_override,
               portfolio: portfolio, skill_label: 'React', skill_id: 'SK-ENG-001',
               ai_level: 2, override_level: 4)
      end

      it 'uses override_level, not ai_level, turning what would have been a gap into match/exceed' do
        vacancy = create(:vacancy, tenant_id: org.id)
        vacancy.vacancy_skills.create!(
          skill_label: 'React',
          skill_id: 'SK-ENG-001',
          expected_level: 4
        )
        engine = described_class.new(portfolio: portfolio, vacancy: vacancy)
        comparisons = engine.build_skill_comparisons

        result = comparisons.find { |c| c[:skill_label] == 'React' }
        expect(result).to be_present
        expect(result[:candidate_level]).to eq(4)   # override (4) used, not ai_level (2)
        expect(result[:result]).to eq('match')      # 4 == 4 (if ai_level was used, 2 < 4 would be gap)
      end

      it 'correctly calculates exceed when override_level > expected_level' do
        vacancy = create(:vacancy, tenant_id: org.id)
        vacancy.vacancy_skills.create!(
          skill_label: 'React',
          skill_id: 'SK-ENG-001',
          expected_level: 3
        )
        engine = described_class.new(portfolio: portfolio, vacancy: vacancy)
        comparisons = engine.build_skill_comparisons

        result = comparisons.find { |c| c[:skill_label] == 'React' }
        expect(result[:candidate_level]).to eq(4)
        expect(result[:result]).to eq('exceed')     # 4 > 3 = exceed
        expect(result[:delta]).to eq(1)
      end
    end

    context 'when candidate level is below expected level without override' do
      before do
        create(:portfolio_skill,
               portfolio: portfolio, skill_label: 'PostgreSQL', skill_id: 'SK-DB-001',
               ai_level: 2)
      end

      it "returns result 'gap' with negative delta" do
        vacancy = create(:vacancy, tenant_id: org.id)
        vacancy.vacancy_skills.create!(
          skill_label: 'PostgreSQL',
          skill_id: 'SK-DB-001',
          expected_level: 4
        )
        engine = described_class.new(portfolio: portfolio, vacancy: vacancy)
        comparisons = engine.build_skill_comparisons

        result = comparisons.find { |c| c[:skill_label] == 'PostgreSQL' }
        expect(result[:candidate_level]).to eq(2)
        expect(result[:result]).to eq('gap')
        expect(result[:delta]).to eq(-2)
      end
    end
  end

  describe '#call' do
    let(:gemini_client) do
      instance_double(
        Gemini::HttpClient,
        generate_content: {
          'culture_narrative' => 'Strong alignment with collaborative culture.',
          'overall_narrative' => 'Candidate meets technical thresholds.'
        }
      )
    end

    before do
      create(:portfolio_skill, portfolio: portfolio, skill_label: 'Ruby', skill_id: 'SK-RB-001', ai_level: 4)
    end

    it 'creates or updates a FitGapReport with comparisons and LLM narrative' do
      vacancy = create(:vacancy, tenant_id: org.id)
      vacancy.vacancy_skills.create!(
        skill_label: 'Ruby',
        skill_id: 'SK-RB-001',
        expected_level: 3
      )

      engine = described_class.new(
        portfolio: portfolio,
        vacancy: vacancy,
        gemini_client: gemini_client
      )

      expect {
        report = engine.call
        expect(report).to be_persisted
        expect(report.tenant_id).to eq(org.id)
        expect(report.culture_narrative).to eq('Strong alignment with collaborative culture.')
        expect(report.overall_narrative).to eq('Candidate meets technical thresholds.')
        expect(report.skill_comparisons.first['result']).to eq('exceed')
      }.to change(FitGapReport, :count).by(1)
    end
  end
end
