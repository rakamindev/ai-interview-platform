# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Candidates::Ranking do
  let(:organization) { create(:organization) }
  let(:tenant_id) { organization.id }
  let(:assessment) { create(:assessment, tenant_id: tenant_id, name: 'Frontend Role') }
  let(:session) { create(:session, assessment: assessment, tenant_id: tenant_id, candidate_name: 'Ahmad Rizky') }
  let(:portfolio) { create(:portfolio, session: session, generation_status: 'complete', tenant_id: tenant_id) }
  let(:vacancy) { create(:vacancy, tenant_id: tenant_id) }

  let!(:portfolio_skill) do
    create(:portfolio_skill, portfolio: portfolio,
           skill_id: 'sk-react', skill_label: 'React',
           ai_level: 4, ai_confidence: 'high')
  end

  let!(:vacancy_skill) do
    create(:vacancy_skill, vacancy: vacancy,
           skill_id: 'sk-react', skill_label: 'React', expected_level: 3)
  end

  subject(:ranking) { described_class.new(vacancy) }

  before do
    Current.tenant_id = tenant_id
  end

  describe '#call' do
    context 'without assessor override' do
      it 'calculates match score and comparisons using ai_level' do
        results = ranking.call
        expect(results.size).to eq(1)

        candidate_match = results.first
        expect(candidate_match[:session_id]).to eq(session.id)
        expect(candidate_match[:candidate_name]).to eq('Ahmad Rizky')
        expect(candidate_match[:score]).to eq(75) # exceed = 0.75 -> 75%

        skill = candidate_match[:skills].first
        expect(skill[:skill_label]).to eq('React')
        expect(skill[:expected_level]).to eq(3)
        expect(skill[:candidate_level]).to eq(4)
        expect(skill[:ai_level]).to eq(4)
        expect(skill[:override_level]).to be_nil
        expect(skill[:is_override]).to eq(false)
        expect(skill[:result]).to eq('exceed')
        expect(skill[:delta]).to eq(1)
      end
    end

    context 'with assessor override' do
      before do
        create(:assessor_override, portfolio_skill: portfolio_skill,
               ai_level: 4, override_level: 3, overridden_by: 1)
      end

      it 'calculates match score and comparisons using override_level' do
        results = ranking.call
        expect(results.size).to eq(1)

        candidate_match = results.first
        expect(candidate_match[:score]).to eq(100) # match = 1.0 -> 100%

        skill = candidate_match[:skills].first
        expect(skill[:candidate_level]).to eq(3)
        expect(skill[:ai_level]).to eq(4)
        expect(skill[:override_level]).to eq(3)
        expect(skill[:is_override]).to eq(true)
        expect(skill[:result]).to eq('match')
        expect(skill[:delta]).to eq(0)
      end
    end
  end
end
