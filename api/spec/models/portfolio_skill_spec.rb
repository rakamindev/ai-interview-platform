# frozen_string_literal: true

require 'rails_helper'

RSpec.describe PortfolioSkill, type: :model do
  describe 'evidence compatibility' do
    subject(:skill) { described_class.new(evidence:) }

    context 'with legacy strings' do
      let(:evidence) { ['Detached historical quote'] }

      it 'keeps the text readable without claiming transcript verification' do
        expect(skill.evidence_items).to eq([{
          'quote' => 'Detached historical quote',
          'turn_id' => nil,
          'turn_number' => nil,
          'verification_status' => 'legacy'
        }])
        expect(skill.evidence_status).to eq('legacy')
      end
    end

    context 'with malformed structured evidence' do
      let(:evidence) { [{ 'quote' => 'Unvalidated model text', 'verification_status' => 'unverified' }] }

      it 'does not expose the model text as candidate evidence' do
        expect(skill.evidence_items).to be_empty
        expect(skill.evidence_status).to eq('insufficient')
      end
    end
  end

  describe 'tenant scoping (F-01 fix)' do
    let(:org_alpha) do
      Organization.create!(
        name: 'Alpha Corp',
        scheme: 'alpha-test',
        identifier: 'alpha-test',
        host: 'alpha.test.local'
      )
    end

    let(:org_beta) do
      Organization.create!(
        name: 'Beta Corp',
        scheme: 'beta-test',
        identifier: 'beta-test',
        host: 'beta.test.local'
      )
    end

    def create_portfolio_with_skill(org, candidate_id, skill_label, level, confidence)
      Current.using(tenant_id: org.id) do
        assessment = Assessment.create!(
          name: "#{skill_label} Assessment",
          tenant_id: org.id,
          created_by: 1,
          time_limit_min: 30
        )
        session = Session.create!(
          assessment_id: assessment.id,
          tenant_id: org.id,
          candidate_id: candidate_id,
          candidate_name: "Candidate #{candidate_id}",
          status: 'ended'
        )
        portfolio = Portfolio.create!(
          session: session,
          candidate_id: candidate_id,
          generation_status: 'complete'
        )
        PortfolioSkill.create!(
          portfolio: portfolio,
          skill_label: skill_label,
          ai_level: level,
          ai_confidence: confidence,
          competency_summary: "#{skill_label} competency summary"
        )
      end
    end

    let!(:skill_alpha) do
      create_portfolio_with_skill(org_alpha, 'cand-alpha', 'Ruby', 4, 'high')
    end

    let!(:skill_beta) do
      create_portfolio_with_skill(org_beta, 'cand-beta', 'Python', 3, 'medium')
    end

    context 'when Current.tenant_id is set to Alpha' do
      before { Current.tenant_id = org_alpha.id }
      after { Current.tenant_id = nil }

      it 'only returns portfolio_skills from tenant Alpha' do
        expect(PortfolioSkill.count).to eq(1)
        expect(PortfolioSkill.first.id).to eq(skill_alpha.id)
      end

      it 'cannot find portfolio_skill from tenant Beta by ID' do
        expect { PortfolioSkill.find(skill_beta.id) }.to raise_error(ActiveRecord::RecordNotFound)
      end
    end

    context 'when Current.tenant_id is set to Beta' do
      before { Current.tenant_id = org_beta.id }
      after { Current.tenant_id = nil }

      it 'only returns portfolio_skills from tenant Beta' do
        expect(PortfolioSkill.count).to eq(1)
        expect(PortfolioSkill.first.id).to eq(skill_beta.id)
      end

      it 'cannot find portfolio_skill from tenant Alpha by ID' do
        expect { PortfolioSkill.find(skill_alpha.id) }.to raise_error(ActiveRecord::RecordNotFound)
      end
    end

    describe 'tenant_id assignment on create' do
      it 'auto-assigns tenant_id from Current.tenant_id' do
        Current.using(tenant_id: org_alpha.id) do
          assessment = Assessment.create!(
            name: 'JS Assessment',
            tenant_id: org_alpha.id,
            created_by: 1,
            time_limit_min: 30
          )
          session = Session.create!(
            assessment_id: assessment.id,
            tenant_id: org_alpha.id,
            candidate_id: 'cand-js',
            candidate_name: 'JS Candidate',
            status: 'ended'
          )
          portfolio = Portfolio.create!(
            session: session,
            candidate_id: 'cand-js',
            generation_status: 'complete'
          )
          skill = PortfolioSkill.create!(
            portfolio: portfolio,
            skill_label: 'JavaScript',
            ai_level: 2,
            ai_confidence: 'low',
            competency_summary: 'JS competency summary'
          )
          expect(skill.tenant_id).to eq(org_alpha.id)
        end
      end

      it 'fails validation when Current.tenant_id is nil' do
        Current.tenant_id = nil
        portfolio = Portfolio.unscoped.find_by(candidate_id: 'cand-alpha')
        skill = PortfolioSkill.new(
          portfolio: portfolio,
          skill_label: 'Go',
          ai_level: 1,
          ai_confidence: 'low',
          competency_summary: 'Go competency summary'
        )
        expect(skill.valid?).to be(false)
        expect(skill.errors[:tenant_id]).to include("can't be blank")
      end
    end
  end
end
