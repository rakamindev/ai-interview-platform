require 'rails_helper'

RSpec.describe Portfolios::Generator, type: :service do
  let(:organization) do
    Organization.create!(
      name: 'Test Corp',
      scheme: 'test-corp',
      identifier: 'test-corp',
      host: 'test.example.com'
    )
  end

  let(:assessment) do
    Assessment.create!(
      tenant_id: organization.id,
      created_by: 1,
      name: 'Backend Test',
      time_limit_min: 30
    )
  end

  let(:session) do
    Session.create!(
      tenant_id: organization.id,
      assessment: assessment,
      status: 'ended'
    )
  end

  let(:portfolio) do
    Portfolio.create!(
      session: session,
      generation_status: 'generating'
    )
  end

  describe '#save_skills' do
    it 'does not invent level 1 ratings for unassessed or nil skill levels' do
      generator = described_class.new(session: session)

      #mock payload simulating gemini return nil ke skill yang unassessed
      raw_ai_payload = {
        'configured_skills' => [
          {
            'skill_id' => 'sk-ruby-01',
            'skill_label' => 'Ruby on Rails',
            'level' => nil,
            'confidence' => 'low',
            'evidence' => [],
            'competency_summary' => 'Candidate did not discuss ruby.'
          }
        ]
      }

      generator.send(:save_skills, portfolio, raw_ai_payload)

      #verify missing evaluation data ga dipaksa menjadi level 1
      created_levels = portfolio.portfolio_skills.reload.map(&:ai_level)
      expect(created_levels).not_to include(1)
    end

    it 'preserves existing skills inside a transaction when replacement creation fails' do
      #seed skill yang ada to verify rollback behavior
      PortfolioSkill.create!(
        portfolio: portfolio,
        skill_label: 'PostgreSQL',
        ai_level: 3,
        ai_confidence: 'high',
        evidence: ['Candidate understands indexing.'],
        competency_summary: 'Solid database knowledge.'
      )

      generator = described_class.new(session: session)

      #invalid payload missing required competency summary to force active record validation failure
      invalid_ai_payload = {
        'configured_skills' => [
          {
            'skill_id' => 'sk-invalid',
            'skill_label' => 'Invalid Skill',
            'level' => 4,
            'confidence' => 'high',
            'evidence' => [],
            'competency_summary' => nil
          }
        ]
      }

      #invoke method expecting error validasi pada item invalid
      expect {
        generator.send(:save_skills, portfolio, invalid_ai_payload)
      }.to raise_error(ActiveRecord::RecordInvalid)

      #verify records sebelumnya tidak didelete ketika operasi gagal
      expect(portfolio.portfolio_skills.reload.count).to eq(1)
      expect(portfolio.portfolio_skills.first.skill_label).to eq('PostgreSQL')
    end
  end
end
