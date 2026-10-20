# frozen_string_literal: true

require 'rails_helper'

# What Postgres itself guarantees, independent of Rails validations. These are
# the last line of defence against a code path that skips validations (bulk
# writes, update_column, a race between two jobs), and they're the constraints
# any migration in Step 5 has to change deliberately.
RSpec.describe 'Database constraints', type: :integration do
  # A failed statement aborts the Postgres transaction the spec runs in, so each
  # attempt runs in its own savepoint.
  def rejected_by_db(error = ActiveRecord::StatementInvalid, &block)
    expect { ActiveRecord::Base.transaction(requires_new: true, &block) }.to raise_error(error)
  end

  # Created up front: a record first built inside a rolled-back savepoint would vanish with it.
  let!(:portfolio) { create(:portfolio) }
  let!(:skill)     { create(:portfolio_skill, portfolio:) }

  describe 'ratings' do
    it 'keeps a stored AI level between 1 and 5, even when validations are skipped' do
      rejected_by_db { skill.update_column(:ai_level, 0) }
      rejected_by_db { skill.update_column(:ai_level, 6) }
    end

    # Step 5 changed this on purpose: "not assessed" is now a state the schema can hold (P0-1),
    # but only as a whole: no level, no confidence, and one of three reasons.
    it 'stores a skill with no level only as "not assessed", with a reason' do
      rejected_by_db { skill.update_columns(ai_level: nil, ai_confidence: nil) }
      rejected_by_db { skill.update_columns(ai_level: nil, ai_confidence: 'high', not_assessed_reason: 'not_reached') }
      rejected_by_db { skill.update_columns(ai_level: nil, ai_confidence: nil, not_assessed_reason: 'too_hard') }
      rejected_by_db { skill.update_columns(not_assessed_reason: 'not_reached') }

      skill.update_columns(ai_level: nil, ai_confidence: nil, competency_summary: nil, not_assessed_reason: 'not_reached')
      expect(skill.reload).to have_attributes(ai_level: nil, not_assessed_reason: 'not_reached')
    end

    it 'keeps override levels between 1 and 5' do
      override = create(:assessor_override, portfolio_skill: skill)

      rejected_by_db { override.update_column(:override_level, 9) }
    end

    it 'accepts only the defined confidence values' do
      rejected_by_db { skill.update_column(:ai_confidence, 'certain') }
    end

    it 'allows one override per rated skill' do
      create(:assessor_override, portfolio_skill: skill)

      rejected_by_db(ActiveRecord::RecordNotUnique) do
        AssessorOverride.insert!({ portfolio_skill_id: skill.id, ai_level: 3, override_level: 2, overridden_by: 1 })
      end
    end
  end

  describe 'one of each per session' do
    it 'allows one portfolio per session' do
      rejected_by_db(ActiveRecord::RecordNotUnique) do
        Portfolio.insert!({ session_id: portfolio.session_id, generation_status: 'pending' })
      end
    end

    it 'allows one fit/gap report per portfolio and vacancy, the lock FitGapReport.claim relies on (P1-6)' do
      vacancy = create(:vacancy)
      create(:fit_gap_report, portfolio:, vacancy:)

      rejected_by_db(ActiveRecord::RecordNotUnique) do
        FitGapReport.insert!({ portfolio_id: portfolio.id, vacancy_id: vacancy.id, skill_comparisons: [] })
      end
    end

    it 'allows one coverage row per skill label in a session' do
      session = create(:session)
      create(:coverage_map, session:, skill_label: 'React')

      rejected_by_db(ActiveRecord::RecordNotUnique) do
        CoverageMap.insert!({ session_id: session.id, skill_label: 'React', state: 'not_yet', probe_count: 0 })
      end
    end

    it 'never issues the same invite token twice' do
      first = create(:session)

      rejected_by_db(ActiveRecord::RecordNotUnique) { create(:session).update_column(:invite_token, first.invite_token) }
    end

    it 'accepts only the defined generation statuses' do
      rejected_by_db { portfolio.update_column(:generation_status, 'queued') }
    end
  end

  describe 'deleting' do
    it 'removes a vacancy together with its skills and fit/gap reports' do
      vacancy = create(:vacancy)
      create(:vacancy_skill, vacancy:)
      create(:fit_gap_report, portfolio:, vacancy:)

      vacancy.destroy!

      expect([VacancySkill.count, FitGapReport.count]).to eq([0, 0])
    end

    it 'removes a portfolio together with its skills and their overrides' do
      create(:assessor_override, portfolio_skill: skill)

      portfolio.destroy!

      expect([PortfolioSkill.count, AssessorOverride.count]).to eq([0, 0])
    end
  end
end
