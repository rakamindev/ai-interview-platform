# frozen_string_literal: true

require 'rails_helper'

RSpec.describe PortfolioSkill, type: :model do
  let(:organization) { Organization.create!(name: 'Test Org', scheme: 'test', identifier: 'test', host: 'localhost') }
  let(:assessment)   { Assessment.create!(tenant_id: 1, created_by: 1, name: 'Frontend Eng', time_limit_min: 45) }
  let(:session)      { Session.create!(tenant_id: 1, assessment: assessment, candidate_name: 'Budi') }
  let(:portfolio)    { Portfolio.create!(session: session, candidate_id: 1, generation_status: 'complete') }

  describe 'validations and unassessed skills handling' do
    it 'is valid with an assessed level between 1 and 5' do
      skill = portfolio.portfolio_skills.build(
        skill_label:        'React',
        status:             'assessed',
        ai_level:           3,
        ai_confidence:      'high',
        evidence:           ['Built performant components'],
        competency_summary: 'Proficient in React architecture'
      )
      expect(skill).to be_valid
      expect(skill.unassessed?).to be false
    end

    it 'allows nil ai_level when status is unassessed' do
      skill = portfolio.portfolio_skills.build(
        skill_label:        'System Design',
        status:             'unassessed',
        ai_level:           nil,
        ai_confidence:      'low',
        evidence:           [],
        competency_summary: 'Skill was not assessed during this interview session.'
      )
      expect(skill).to be_valid
      expect(skill.unassessed?).to be true
    end

    it 'rejects ai_level outside 1..5 when present' do
      skill = portfolio.portfolio_skills.build(
        skill_label:        'React',
        status:             'assessed',
        ai_level:           6,
        ai_confidence:      'high',
        competency_summary: 'Out of bounds'
      )
      expect(skill).not_to be_valid
      expect(skill.errors[:ai_level]).to be_present
    end

    it 'rejects invalid status' do
      skill = portfolio.portfolio_skills.build(
        skill_label:        'React',
        status:             'unknown_status',
        ai_level:           2,
        ai_confidence:      'medium',
        competency_summary: 'Summary'
      )
      expect(skill).not_to be_valid
      expect(skill.errors[:status]).to be_present
    end
  end

  describe 'scopes' do
    it 'filters assessed and unassessed skills' do
      assessed = portfolio.portfolio_skills.create!(
        skill_label:        'React',
        status:             'assessed',
        ai_level:           4,
        ai_confidence:      'high',
        evidence:           ['Quote'],
        competency_summary: 'Advanced'
      )

      unassessed = portfolio.portfolio_skills.create!(
        skill_label:        'Kubernetes',
        status:             'unassessed',
        ai_level:           nil,
        ai_confidence:      'low',
        evidence:           [],
        competency_summary: 'Not assessed'
      )

      expect(portfolio.portfolio_skills.assessed).to include(assessed)
      expect(portfolio.portfolio_skills.assessed).not_to include(unassessed)

      expect(portfolio.portfolio_skills.unassessed).to include(unassessed)
      expect(portfolio.portfolio_skills.unassessed).not_to include(assessed)
    end
  end
end
