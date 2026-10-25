# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Portfolio, type: :model do
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

    let(:assessment_alpha) do
      Assessment.create!(
        name: 'Alpha Assessment',
        tenant_id: org_alpha.id,
        created_by: 1,
        time_limit_min: 30
      )
    end

    let(:assessment_beta) do
      Assessment.create!(
        name: 'Beta Assessment',
        tenant_id: org_beta.id,
        created_by: 1,
        time_limit_min: 30
      )
    end

    let(:session_alpha) do
      Session.create!(
        assessment_id: assessment_alpha.id,
        tenant_id: org_alpha.id,
        candidate_id: 'cand-alpha',
        candidate_name: 'Alpha Candidate',
        status: 'ended'
      )
    end

    let(:session_beta) do
      Session.create!(
        assessment_id: assessment_beta.id,
        tenant_id: org_beta.id,
        candidate_id: 'cand-beta',
        candidate_name: 'Beta Candidate',
        status: 'ended'
      )
    end

    let!(:portfolio_alpha) do
      Current.using(tenant_id: org_alpha.id) do
        Portfolio.create!(
          session: session_alpha,
          candidate_id: 'cand-alpha',
          generation_status: 'complete'
        )
      end
    end

    let!(:portfolio_beta) do
      Current.using(tenant_id: org_beta.id) do
        Portfolio.create!(
          session: session_beta,
          candidate_id: 'cand-beta',
          generation_status: 'complete'
        )
      end
    end

    context 'when Current.tenant_id is set to Alpha' do
      before { Current.tenant_id = org_alpha.id }
      after { Current.tenant_id = nil }

      it 'only returns portfolios from tenant Alpha' do
        expect(Portfolio.count).to eq(1)
        expect(Portfolio.first.id).to eq(portfolio_alpha.id)
      end

      it 'cannot find portfolio from tenant Beta by ID' do
        expect { Portfolio.find(portfolio_beta.id) }.to raise_error(ActiveRecord::RecordNotFound)
      end

      it 'can find portfolio from tenant Alpha by ID' do
        expect(Portfolio.find(portfolio_alpha.id)).to eq(portfolio_alpha)
      end
    end

    context 'when Current.tenant_id is set to Beta' do
      before { Current.tenant_id = org_beta.id }
      after { Current.tenant_id = nil }

      it 'only returns portfolios from tenant Beta' do
        expect(Portfolio.count).to eq(1)
        expect(Portfolio.first.id).to eq(portfolio_beta.id)
      end

      it 'cannot find portfolio from tenant Alpha by ID' do
        expect { Portfolio.find(portfolio_alpha.id) }.to raise_error(ActiveRecord::RecordNotFound)
      end
    end

    context 'when Current.tenant_id is not set (unscoped context)' do
      before { Current.tenant_id = nil }

      it 'returns no portfolios (default_scope filters by nil tenant)' do
        expect(Portfolio.count).to eq(0)
      end

      it 'can access all portfolios via unscoped' do
        expect(Portfolio.unscoped.count).to eq(2)
      end
    end

    describe 'tenant_id assignment on create' do
      it 'auto-assigns tenant_id from Current.tenant_id' do
        Current.using(tenant_id: org_alpha.id) do
          new_assessment = Assessment.create!(
            name: 'New Assessment',
            tenant_id: org_alpha.id,
            created_by: 1,
            time_limit_min: 30
          )
          new_session = Session.create!(
            assessment_id: new_assessment.id,
            tenant_id: org_alpha.id,
            candidate_id: 'cand-new',
            candidate_name: 'New Candidate',
            status: 'ended'
          )
          portfolio = Portfolio.create!(
            session: new_session,
            candidate_id: 'cand-new',
            generation_status: 'complete'
          )
          expect(portfolio.tenant_id).to eq(org_alpha.id)
        end
      end

      it 'fails validation when Current.tenant_id is nil' do
        Current.tenant_id = nil
        portfolio = Portfolio.new(
          session: session_alpha,
          candidate_id: 'cand-fail',
          generation_status: 'complete'
        )
        expect(portfolio.valid?).to be(false)
        expect(portfolio.errors[:tenant_id]).to include("can't be blank")
      end
    end
  end
end