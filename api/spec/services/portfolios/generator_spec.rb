# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Portfolios::Generator, '#save_skills' do
  # AI Verification Moment (Phase 4.3):
  #
  # BUG FOUND IN AI-GENERATED CODE:
  #   Original code: `ai_level: skill_data['level'].to_i.clamp(1, 5)`
  #   Problem: When the AI returns nil or missing level, `.to_i` silently converts
  #            nil → 0, then `.clamp(1, 5)` maps it to 1, creating a FALSE L1 assignment.
  #            This made unassessed skills appear as L1-rated, corrupting the portfolio.
  #
  # FIX APPLIED:
  #   Added `next if level <= 0` guard before creating the record, so skills
  #   with no AI evidence are simply omitted (left as `not_assessed` in FitGap).

  let(:portfolio) { instance_double(Portfolio, id: 1) }
  let(:portfolio_skills_relation) { instance_double(ActiveRecord::Associations::CollectionProxy) }

  before do
    allow(portfolio).to receive(:portfolio_skills).and_return(portfolio_skills_relation)
    allow(portfolio_skills_relation).to receive(:destroy_all)
    allow(portfolio_skills_relation).to receive(:create!)
  end

  subject { described_class.new(session: instance_double(Session, id: 1, candidate_id: 1, assessment: nil)) }

  describe 'AI level safety guard (AI Verification Moment)' do
    it 'SKIPS creating a PortfolioSkill when AI returns nil level (prevents false L1 bug)' do
      data = {
        'configured_skills' => [
          { 'skill_id' => 'sk-1', 'skill_label' => 'Ruby', 'level' => nil,
            'confidence' => 'low', 'evidence' => [], 'competency_summary' => 'N/A' }
        ],
        'discovered_skills' => []
      }

      # The guard should prevent create! from being called for nil level
      expect(portfolio_skills_relation).not_to receive(:create!)

      # Call the private method directly for unit testing
      subject.send(:save_skills, portfolio, data)
    end

    it 'SKIPS creating a PortfolioSkill when AI returns level 0' do
      data = {
        'configured_skills' => [
          { 'skill_id' => 'sk-1', 'skill_label' => 'Ruby', 'level' => 0,
            'confidence' => 'low', 'evidence' => [], 'competency_summary' => '' }
        ],
        'discovered_skills' => []
      }

      expect(portfolio_skills_relation).not_to receive(:create!)
      subject.send(:save_skills, portfolio, data)
    end

    it 'CREATES a PortfolioSkill when AI returns a valid level (1..5)' do
      data = {
        'configured_skills' => [
          { 'skill_id' => 'sk-1', 'skill_label' => 'Ruby', 'level' => 3,
            'confidence' => 'high', 'evidence' => ['quote1'], 'competency_summary' => 'Good' }
        ],
        'discovered_skills' => []
      }

      expect(portfolio_skills_relation).to receive(:create!).with(
        hash_including(ai_level: 3, ai_confidence: 'high')
      )
      subject.send(:save_skills, portfolio, data)
    end

    it 'uses default confidence "low" when AI omits confidence field' do
      data = {
        'configured_skills' => [
          { 'skill_id' => 'sk-1', 'skill_label' => 'Ruby', 'level' => 2,
            'confidence' => nil, 'evidence' => [], 'competency_summary' => 'Some summary' }
        ],
        'discovered_skills' => []
      }

      expect(portfolio_skills_relation).to receive(:create!).with(
        hash_including(ai_confidence: 'low')
      )
      subject.send(:save_skills, portfolio, data)
    end
  end
end
