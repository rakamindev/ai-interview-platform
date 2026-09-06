# frozen_string_literal: true

require 'rails_helper'

RSpec.describe PortfolioSkill, type: :model do
  include FactoryHelpers

  let(:org)        { create_org!(name: 'Test', scheme: 'test-corp') }
  let(:assessment) { create(:assessment, tenant_id: org.id) }
  let(:session)    { create(:session, assessment: assessment, tenant_id: org.id) }
  let(:portfolio)  { create(:portfolio, session: session, tenant_id: org.id) }

  describe 'validations' do
    it 'is valid when assessed with ai_level in 1..5 and not_assessed: false' do
      skill = described_class.new(
        portfolio:          portfolio,
        skill_label:        'Ruby',
        ai_level:           3,
        ai_confidence:      'high',
        not_assessed:       false,
        competency_summary: 'Solid Ruby knowledge.'
      )
      expect(skill).to be_valid
    end

    it 'is valid when not_assessed is true and ai_level is nil' do
      skill = described_class.new(
        portfolio:          portfolio,
        skill_label:        'Ruby',
        ai_level:           nil,
        ai_confidence:      nil,
        not_assessed:       true,
        competency_summary: 'Not assessed'
      )
      expect(skill).to be_valid
    end

    it 'is invalid when ai_level is nil and not_assessed is false' do
      skill = described_class.new(
        portfolio:          portfolio,
        skill_label:        'Ruby',
        ai_level:           nil,
        not_assessed:       false,
        competency_summary: 'Solid Ruby knowledge.'
      )
      expect(skill).not_to be_valid
      expect(skill.errors[:ai_level]).to include('must be present when skill is assessed')
    end

    it 'is invalid when ai_level is set and not_assessed is true' do
      skill = described_class.new(
        portfolio:          portfolio,
        skill_label:        'Ruby',
        ai_level:           3,
        not_assessed:       true,
        competency_summary: 'Solid Ruby knowledge.'
      )
      expect(skill).not_to be_valid
      expect(skill.errors[:not_assessed]).to include('cannot be true when ai_level is set')
    end

    it 'is invalid when ai_level is outside 1..5' do
      skill = described_class.new(
        portfolio:          portfolio,
        skill_label:        'Ruby',
        ai_level:           6,
        not_assessed:       false,
        competency_summary: 'Solid Ruby knowledge.'
      )
      expect(skill).not_to be_valid
      expect(skill.errors[:ai_level]).to be_present
    end
  end
end
