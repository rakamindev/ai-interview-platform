# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Portfolios::Generator, type: :service do
  let!(:assessment) do
    Assessment.create!(
      tenant_id: 123_456,
      created_by: 1,
      name: 'Senior Full Stack Engineer',
      time_limit_min: 45
    )
  end

  let!(:session) do
    Session.create!(
      tenant_id: 123_456,
      assessment: assessment,
      candidate_name: 'Test Candidate'
    )
  end

  let!(:portfolio) do
    Portfolio.create!(
      session: session,
      candidate_id: session.candidate_id,
      generation_status: 'pending'
    )
  end

  let(:gemini_client) { instance_double(Gemini::HttpClient) }

  subject(:generator) do
    described_class.new(
      session: session,
      gemini_client: gemini_client
    )
  end

  describe '#call' do
    it 'generates portfolio skills and marks the portfolio complete' do
      allow(gemini_client).to receive(:generate_content).and_return(
        {
          'configured_skills' => [
            {
              'skill_id' => 'python',
              'skill_label' => 'Python',
              'level' => 4,
              'confidence' => 'high',
              'evidence' => ['I use Python every day.'],
              'competency_summary' => 'Strong Python experience.'
            }
          ],
          'discovered_skills' => [
            {
              'skill_label' => 'System Design',
              'level' => 3,
              'confidence' => 'medium',
              'evidence' => ['I designed the service architecture.'],
              'competency_summary' => 'Demonstrates solid system design experience.'
            }
          ]
        }
      )

      result = generator.call

      expect(result.reload).to be_complete
      expect(result.generated_at).to be_present
      expect(result.generation_error).to be_nil

      skills = result.portfolio_skills.order(:id)

      expect(skills.size).to eq(2)

      expect(skills[0]).to have_attributes(
        skill_id: 'python',
        skill_label: 'Python',
        is_discovered: false,
        ai_level: 4,
        ai_confidence: 'high'
      )

      expect(skills[1]).to have_attributes(
        skill_id: nil,
        skill_label: 'System Design',
        is_discovered: true,
        ai_level: 3,
        ai_confidence: 'medium'
      )
    end

    it 'keeps the existing skills intact when regeneration fails partway through' do
      existing_skill = portfolio.portfolio_skills.create!(
        skill_id: 'ruby',
        skill_label: 'Ruby',
        is_discovered: false,
        ai_level: 3,
        ai_confidence: 'medium',
        evidence: ['I have used Ruby professionally.'],
        competency_summary: 'Solid Ruby experience.'
      )

      allow(gemini_client).to receive(:generate_content).and_return(
        {
          'configured_skills' => [
            {
              'skill_id' => 'python',
              'skill_label' => 'Python',
              'level' => 4,
              'confidence' => 'high',
              'evidence' => ['I use Python every day.'],
              'competency_summary' => 'Strong Python experience.'
            },
            {
              'skill_id' => 'django',
              'skill_label' => 'Django',
              'level' => 4,
              'confidence' => 'invalid-confidence',
              'evidence' => ['I build applications with Django.'],
              'competency_summary' => 'Strong Django experience.'
            }
          ],
          'discovered_skills' => []
        }
      )

      expect { generator.call }.to raise_error(ActiveRecord::RecordInvalid)

      portfolio.reload

      expect(portfolio.generation_status).to eq('failed')
      expect(portfolio.generation_error).to be_present

      skills = portfolio.portfolio_skills.reload

      expect(skills.map(&:id)).to eq([existing_skill.id])
      expect(skills.first).to have_attributes(
        skill_id: 'ruby',
        skill_label: 'Ruby',
        ai_level: 3
      )
    end
  end
end
