# frozen_string_literal: true

require 'rails_helper'

# The rules each record enforces before it reaches the database.
RSpec.describe 'Model validations' do
  describe Assessment do
    it 'accepts only the time limits the product offers' do
      expect([10, 30, 45, 60, 90].map { build(:assessment, time_limit_min: _1).valid? }).to all(be true)
      expect([0, 15, 120, nil].map { build(:assessment, time_limit_min: _1).valid? }).to all(be false)
    end

    it 'accepts English or Bahasa Indonesia, or no language' do
      expect(%w[en id].map { build(:assessment, language: _1).valid? }).to all(be true)
      expect(build(:assessment, language: nil)).to be_valid
      expect(build(:assessment, language: 'fr')).not_to be_valid
    end

    it 'requires a name' do
      expect(build(:assessment, name: '')).not_to be_valid
    end

    it 'cannot be deleted while it has sessions' do
      assessment = create(:assessment)
      create(:session, assessment:)

      expect(assessment.destroy).to be(false)
      expect(assessment.errors.full_messages.join).to match(/sessions/i)
    end
  end

  describe AssessmentSkill do
    it 'requires all five level anchors' do
      %i[l1_anchor l2_anchor l3_anchor l4_anchor l5_anchor].each do |anchor|
        expect(build(:assessment_skill, anchor => '')).not_to be_valid
      end
    end

    it 'allows no expected level, or a whole level from 1 to 5' do
      expect([nil, 1, 5].map { build(:assessment_skill, expected_level: _1).valid? }).to all(be true)
      expect([0, 6, 2.5].map { build(:assessment_skill, expected_level: _1).valid? }).to all(be false)
    end
  end

  describe VacancySkill do
    it 'requires a whole expected level from 1 to 5' do
      expect(build(:vacancy_skill, expected_level: 3)).to be_valid
      expect([nil, 0, 6].map { build(:vacancy_skill, expected_level: _1).valid? }).to all(be false)
    end
  end

  describe AssessorOverride do
    it 'requires a whole override level from 1 to 5 and who made it' do
      expect(build(:assessor_override, override_level: 4)).to be_valid
      expect([0, 6, nil].map { build(:assessor_override, override_level: _1).valid? }).to all(be false)
      expect(build(:assessor_override, overridden_by: nil)).not_to be_valid
    end
  end

  describe CoverageMap do
    it 'accepts only the four coverage states and a non-negative probe count' do
      expect(CoverageMap::STATES.map { build(:coverage_map, state: _1).valid? }).to all(be true)
      expect(build(:coverage_map, state: 'discovered')).not_to be_valid
      expect(build(:coverage_map, probe_count: -1)).not_to be_valid
    end
  end

  describe TranscriptTurn do
    it 'needs a speaker of ai or candidate, a positive turn number and some text' do
      expect(build(:transcript_turn)).to be_valid
      expect(build(:transcript_turn, speaker: 'assessor')).not_to be_valid
      expect(build(:transcript_turn, turn_number: 0)).not_to be_valid
      expect(build(:transcript_turn, text: '')).not_to be_valid
    end
  end

  describe User do
    it 'stores the email in lower case and keeps it unique regardless of case' do
      create(:user, email: 'Dimas@Example.test')

      expect(User.last.email).to eq('dimas@example.test')
      expect(build(:user, email: 'DIMAS@example.test')).not_to be_valid
    end

    it 'rejects malformed emails and unknown roles' do
      expect(build(:user, email: 'not-an-email')).not_to be_valid
      expect(build(:user, role: 'superadmin')).not_to be_valid
    end
  end

  describe Portfolio do
    it 'accepts only the four generation statuses' do
      expect(%w[pending generating complete failed].map { build(:portfolio, generation_status: _1).valid? }).to all(be true)
      expect(build(:portfolio, generation_status: 'queued')).not_to be_valid
    end
  end
end
