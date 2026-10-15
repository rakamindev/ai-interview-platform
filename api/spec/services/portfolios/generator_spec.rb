require 'rails_helper'
require_relative '../../../app/services/portfolios/generator'

RSpec.describe Portfolios::Generator do
  describe '#call' do
    it 'marks the portfolio complete when generation succeeds' do
      session = double('session', id: 1)
      portfolio = double('portfolio')
      gemini_client = double('gemini client', generate_content: '{"configured_skills":[],"discovered_skills":[]}')

      allow(session).to receive(:portfolio).and_return(portfolio)
      allow(portfolio).to receive(:update!)

      generator = described_class.new(
        session: session,
        gemini_client: gemini_client
      )

      allow(generator).to receive(:build_prompt).and_return('test prompt')
      allow(generator).to receive(:save_skills)

      expect(portfolio).to receive(:update!).with(generation_status: 'generating')
      expect(portfolio).to receive(:update!).with(
        generation_status: 'complete',
        generated_at: kind_of(ActiveSupport::TimeWithZone)
      )

      expect(generator.call).to eq(portfolio)
    end
  end

  describe '#save_skills' do
    let(:skills) { double('portfolio skills') }
    let(:portfolio) { double('portfolio', portfolio_skills: skills) }
    let(:generator) { described_class.allocate }

    before do
      allow(skills).to receive(:destroy_all)
      allow(skills).to receive(:create!)
    end

    it 'rejects an invalid level for a configured skill' do
      response = {
        'configured_skills' => [
          {
            'skill_id' => 1,
            'skill_label' => 'Communication',
            'level' => 'abc',
            'confidence' => 'low',
            'evidence' => [],
            'competency_summary' => 'Test'
          }
        ]
      }

      expect do
        generator.send(:save_skills, portfolio, response)
      end.to raise_error(ArgumentError)
    end

    it 'rejects an invalid level for a discovered skill' do
      response = {
        'discovered_skills' => [
          {
            'skill_label' => 'Problem Solving',
            'level' => 'abc',
            'confidence' => 'low',
            'evidence' => [],
            'competency_summary' => 'Test'
          }
        ]
      }

      expect do
        generator.send(:save_skills, portfolio, response)
      end.to raise_error(ArgumentError)
    end

    it 'clamps a valid numeric level to the allowed range' do
      response = {
        'configured_skills' => [
          {
            'skill_id' => 1,
            'skill_label' => 'Communication',
            'level' => 7,
            'confidence' => 'high',
            'evidence' => [],
            'competency_summary' => 'Test'
          }
        ]
      }

      expect(skills).to receive(:create!).with(
        hash_including(ai_level: 5)
      )

      generator.send(:save_skills, portfolio, response)
    end

    it 'rolls back existing skills when saving a replacement fails' do
      organization = Organization.create!(
        name: 'Test Organization',
        scheme: "test-#{SecureRandom.hex(6)}",
        identifier: SecureRandom.hex(8),
        host: "test-#{SecureRandom.hex(6)}.example.com"
      )

      user = User.create!(
        email: "test-#{SecureRandom.hex(6)}@example.com",
        password: 'test-password'
      )

      assessment = Assessment.create!(
        tenant_id: organization.id,
        created_by: user.id,
        name: 'Test Assessment',
        time_limit_min: 30
      )

      session = Session.create!(
        tenant_id: organization.id,
        assessment: assessment
      )

      real_portfolio = Portfolio.create!(
        session: session,
        generation_status: 'pending'
      )

      real_portfolio.portfolio_skills.create!(
        skill_label: 'Existing Skill',
        ai_level: 2,
        ai_confidence: 'medium',
        evidence: [],
        competency_summary: 'Existing skill summary'
      )

      response = {
        'configured_skills' => [
          {
            'skill_id' => 'skill-new',
            'skill_label' => 'New Skill',
            'level' => 3,
            'confidence' => 'high',
            'evidence' => [],
            'competency_summary' => 'New skill summary'
          },
          {
            'skill_id' => 'skill-invalid',
            'skill_label' => 'Invalid Skill',
            'level' => 4,
            'confidence' => 'invalid',
            'evidence' => [],
            'competency_summary' => 'Invalid skill summary'
          }
        ]
      }

      expect do
        generator.send(:save_skills, real_portfolio, response)
      end.to raise_error(ActiveRecord::RecordInvalid)

      expect(
        real_portfolio.portfolio_skills.reload.pluck(:skill_label)
      ).to eq(['Existing Skill'])
    end
  end
end
