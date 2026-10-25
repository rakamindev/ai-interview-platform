# frozen_string_literal: true

require 'rails_helper'

RSpec.describe FitGapReport, type: :model do
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

    def create_fit_gap(org, candidate_id, scheme, skill_label, result)
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
        vacancy = Vacancy.create!(
          role_title: "#{skill_label} Role",
          tenant_id: org.id,
          created_by: 1
        )
        FitGapReport.create!(
          portfolio: portfolio,
          vacancy: vacancy,
          skill_comparisons: [{ skill: skill_label, result: result }],
          overall_narrative: "#{skill_label} overall narrative"
        )
      end
    end

    let!(:report_alpha) do
      create_fit_gap(org_alpha, 'cand-alpha', 'alpha-test', 'Ruby', 'gap')
    end

    let!(:report_beta) do
      create_fit_gap(org_beta, 'cand-beta', 'beta-test', 'Python', 'exceed')
    end

    context 'when Current.tenant_id is set to Alpha' do
      before { Current.tenant_id = org_alpha.id }
      after { Current.tenant_id = nil }

      it 'only returns fit_gap_reports from tenant Alpha' do
        expect(FitGapReport.count).to eq(1)
        expect(FitGapReport.first.id).to eq(report_alpha.id)
      end

      it 'cannot find fit_gap_report from tenant Beta by ID' do
        expect { FitGapReport.find(report_beta.id) }.to raise_error(ActiveRecord::RecordNotFound)
      end
    end

    context 'when Current.tenant_id is set to Beta' do
      before { Current.tenant_id = org_beta.id }
      after { Current.tenant_id = nil }

      it 'only returns fit_gap_reports from tenant Beta' do
        expect(FitGapReport.count).to eq(1)
        expect(FitGapReport.first.id).to eq(report_beta.id)
      end

      it 'cannot find fit_gap_report from tenant Alpha by ID' do
        expect { FitGapReport.find(report_alpha.id) }.to raise_error(ActiveRecord::RecordNotFound)
      end
    end

    describe 'tenant_id assignment on create' do
      it 'auto-assigns tenant_id from Current.tenant_id' do
        Current.using(tenant_id: org_alpha.id) do
          assessment = Assessment.create!(
            name: 'Java Assessment',
            tenant_id: org_alpha.id,
            created_by: 1,
            time_limit_min: 30
          )
          session = Session.create!(
            assessment_id: assessment.id,
            tenant_id: org_alpha.id,
            candidate_id: 'cand-java',
            candidate_name: 'Java Candidate',
            status: 'ended'
          )
          portfolio = Portfolio.create!(
            session: session,
            candidate_id: 'cand-java',
            generation_status: 'complete'
          )
          vacancy = Vacancy.create!(
            role_title: 'Java Role',
            tenant_id: org_alpha.id,
            created_by: 1
          )
          report = FitGapReport.create!(
            portfolio: portfolio,
            vacancy: vacancy,
            skill_comparisons: [{ skill: 'Java', result: 'match' }],
            overall_narrative: 'Java overall narrative'
          )
          expect(report.tenant_id).to eq(org_alpha.id)
        end
      end

      it 'fails validation when Current.tenant_id is nil' do
        Current.tenant_id = nil
        portfolio = Portfolio.unscoped.find_by(candidate_id: 'cand-alpha')
        vacancy = Vacancy.unscoped.first
        report = FitGapReport.new(
          portfolio: portfolio,
          vacancy: vacancy,
          skill_comparisons: [{ skill: 'Go', result: 'match' }],
          overall_narrative: 'Go overall narrative'
        )
        expect(report.valid?).to be(false)
        expect(report.errors[:tenant_id]).to include("can't be blank")
      end
    end
  end
end