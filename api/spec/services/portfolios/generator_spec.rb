# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Portfolios::Generator do
  let(:assessment) { Assessment.create!(tenant_id: 1, created_by: 1, name: 'React Portfolio', time_limit_min: 30) }
  let(:session)    { Session.create!(tenant_id: 1, assessment: assessment, status: 'ended') }

  describe '#call' do
    context 'when the model returns zero skills' do
      it 'fails the portfolio instead of marking it complete without evidence' do
        gemini = instance_double(Gemini::HttpClient, generate_content: {
          'configured_skills' => [],
          'discovered_skills' => []
        })

        expect { described_class.new(session: session, gemini_client: gemini).call }
          .to raise_error(RuntimeError, /zero skills/)

        portfolio = session.portfolio
        expect(portfolio.generation_status).to eq('failed')
        expect(portfolio.generation_error).to include('zero skills')
      end
    end

    context 'when the model returns valid skills' do
      it 'marks the portfolio complete' do
        gemini = instance_double(Gemini::HttpClient, generate_content: {
          'configured_skills' => [{
            'skill_id'           => 'sk-eng-001',
            'skill_label'        => 'React Development',
            'level'              => 3,
            'confidence'         => 'high',
            'evidence'           => ['candidate explained state handling'],
            'competency_summary' => 'Reliable under complex scope.'
          }],
          'discovered_skills'  => []
        })

        portfolio = described_class.new(session: session, gemini_client: gemini).call

        expect(portfolio.generation_status).to eq('complete')
        expect(portfolio.portfolio_skills.count).to eq(1)
      end
    end

    context 'when a duplicate job runs for an already-generated portfolio' do
      it 'returns immediately without calling the model again (no wasted quota)' do
        Portfolio.create!(session: session, candidate_id: 1, generation_status: 'complete')
        gemini = instance_double(Gemini::HttpClient)
        allow(gemini).to receive(:generate_content) { raise 'Gemini should NOT be called for a duplicate job' }

        portfolio = described_class.new(session: session, gemini_client: gemini).call

        expect(portfolio).to be_complete
        expect(portfolio.portfolio_skills.count).to eq(0)
      end
    end

    context 'when saving skills fails part-way through (partial write)' do
      it 'rolls the partial rows back and marks the portfolio failed' do
        gemini = instance_double(Gemini::HttpClient, generate_content: {
          'configured_skills' => [
            {
              'skill_id'           => 'sk-eng-001',
              'skill_label'        => 'React Development',
              'level'              => 3,
              'confidence'         => 'high',
              'evidence'           => ['candidate explained state handling'],
              'competency_summary' => 'Reliable under complex scope.'
            },
            {
              'skill_id'           => 'sk-eng-002',
              'skill_label'        => 'Node.js Backend',
              'level'              => 2,
              'confidence'         => 'medium',
              'evidence'           => ['candidate described API design'],
              # competency_summary omitted on purpose -> create! raises
            }
          ],
          'discovered_skills' => []
        })

        expect { described_class.new(session: session, gemini_client: gemini).call }
          .to raise_error(ActiveRecord::RecordInvalid)

        portfolio = session.portfolio
        expect(portfolio).to be_failed
        expect(portfolio.reload.portfolio_skills.count).to eq(0)
        expect(portfolio.generation_error).to match(/competency summary/i)
      end
    end
  end
end