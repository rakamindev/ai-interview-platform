# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Portfolios::Generator, type: :model do # rubocop:disable Metrics/BlockLength
  let(:session) { create(:session, status: 'ended') }
  let!(:portfolio) { create(:portfolio, session: session, generation_status: 'pending') }
  let!(:existing_skill) do
    create(:portfolio_skill, portfolio: portfolio, skill_label: 'Old Skill')
  end
  let(:valid_skill) do
    { 'skill_id' => 1, 'skill_label' => 'Python', 'level' => 4, 'confidence' => 'high',
      'evidence' => ['candidate used Python for data pipelines'], 'competency_summary' => 'Solid Python.' }
  end
  let(:broken_skill) do
    { 'skill_id' => 2, 'skill_label' => 'Broken', 'level' => 3, 'confidence' => 'high' }
  end
  let(:payload) { { 'configured_skills' => [valid_skill], 'discovered_skills' => [] } }

  def generate_with(gemini_payload)
    client = double('gemini', generate_content: gemini_payload)
    Portfolios::Generator.new(session: session, gemini_client: client).call
  end

  describe '#call' do
    it 'replaces skills and marks the portfolio complete' do
      generate_with(payload)

      expect(portfolio.reload.generation_status).to eq('complete')
      expect(portfolio.portfolio_skills.reload.map(&:skill_label)).to eq(['Python'])
    end

    it 'marks the portfolio failed and raises when a skill cannot be saved' do
      bad_payload = payload.deep_dup.tap { |p| p['configured_skills'] << broken_skill }

      expect { generate_with(bad_payload) }.to raise_error(ActiveRecord::RecordInvalid)

      expect(portfolio.reload.generation_status).to eq('failed')
    end

    it 'rolls back destroyed skills atomically when a save fails' do
      bad_payload = payload.deep_dup.tap { |p| p['configured_skills'] << broken_skill }

      expect { generate_with(bad_payload) }.to raise_error(ActiveRecord::RecordInvalid)

      # destroy_all inside save_skills must be rolled back — no partial wipe
      expect(portfolio.portfolio_skills.reload.map(&:skill_label)).to eq(['Old Skill'])
    end
  end
end
