# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Portfolios::Generator do
  subject(:portfolio) { described_class.new(session: session, gemini_client: gemini_client).call }

  let(:session) { create(:session) }
  let(:gemini_client) { instance_double(Gemini::HttpClient, generate_content: response) }

  before do
    create(:skill_taxonomy, skill_id: 'SK-ENG-001', skill_label: 'React / Frontend Development Core')
  end

  context 'when the model returns the taxonomy id in the wrong case' do
    let(:response) do
      {
        'configured_skills' => [
          {
            'skill_id' => 'sk-eng-001',
            'skill_label' => 'React / Frontend Development Core',
            'level' => 3,
            'confidence' => 'high',
            'evidence' => ['A revealing quote.'],
            'competency_summary' => 'Reliable at this skill.'
          }
        ]
      }
    end

    it 'stores the canonical taxonomy id' do
      expect(portfolio.portfolio_skills.first.skill_id).to eq('SK-ENG-001')
    end
  end

  context 'when the model invents an id but the label matches the taxonomy' do
    let(:response) do
      {
        'configured_skills' => [
          {
            'skill_id' => 'react-core',
            'skill_label' => 'react / frontend development core',
            'level' => 3,
            'confidence' => 'high',
            'evidence' => ['A revealing quote.'],
            'competency_summary' => 'Reliable at this skill.'
          }
        ]
      }
    end

    it 'resolves the id from the label' do
      expect(portfolio.portfolio_skills.first.skill_id).to eq('SK-ENG-001')
    end
  end

  context 'when neither the id nor the label matches the taxonomy' do
    let(:response) do
      {
        'configured_skills' => [
          {
            'skill_id' => 'sk-made-up-999',
            'skill_label' => 'Totally Custom Skill',
            'level' => 2,
            'confidence' => 'medium',
            'evidence' => ['A quote.'],
            'competency_summary' => 'Summary.'
          }
        ],
        'discovered_skills' => [
          {
            'skill_label' => 'Another Custom Skill',
            'level' => 2,
            'confidence' => 'low',
            'evidence' => ['A quote.'],
            'competency_summary' => 'Summary.'
          }
        ]
      }
    end

    it 'stores nil instead of the invented id' do
      expect(portfolio.portfolio_skills.map(&:skill_id)).to eq([nil, nil])
    end
  end

  context 'when a discovered skill label matches the taxonomy' do
    let(:response) do
      {
        'discovered_skills' => [
          {
            'skill_label' => 'React / Frontend Development Core',
            'level' => 4,
            'confidence' => 'medium',
            'evidence' => ['A quote.'],
            'competency_summary' => 'Summary.'
          }
        ]
      }
    end

    it 'resolves the taxonomy id for it too' do
      expect(portfolio.portfolio_skills.first.skill_id).to eq('SK-ENG-001')
      expect(portfolio.portfolio_skills.first.is_discovered).to be(true)
    end
  end

  context 'when the model call times out' do
    let(:gemini_client) { instance_double(Gemini::HttpClient) }

    before do
      allow(gemini_client).to receive(:generate_content)
        .and_raise(Gemini::HttpClient::TimeoutError, 'Gemini API timeout after 180s')
    end

    it 'fails the portfolio without leaving skills behind' do
      expect { portfolio }.to raise_error(Gemini::HttpClient::TimeoutError)

      reloaded = session.portfolio.reload
      expect(reloaded.generation_status).to eq('failed')
      expect(reloaded.generation_error).to be_present
      expect(reloaded.portfolio_skills).to be_empty
    end
  end

  context 'when generation runs twice (duplicate job)' do
    let(:response) do
      {
        'configured_skills' => [
          {
            'skill_id' => 'SK-ENG-001',
            'skill_label' => 'React / Frontend Development Core',
            'level' => 3,
            'confidence' => 'high',
            'evidence' => ['A quote.'],
            'competency_summary' => 'Summary.'
          }
        ]
      }
    end

    it 'replaces existing skills instead of duplicating them' do
      described_class.new(session: session, gemini_client: gemini_client).call
      described_class.new(session: session, gemini_client: gemini_client).call

      expect(session.portfolio.reload.portfolio_skills.count).to eq(1)
    end
  end

  context 'when the model returns malformed JSON' do
    let(:response) { 'not json at all' }

    it 'fails the portfolio and stores no skills' do
      expect { portfolio }.to raise_error(JSON::ParserError)

      reloaded = session.portfolio.reload
      expect(reloaded.generation_status).to eq('failed')
      expect(reloaded.generation_error).to be_present
      expect(reloaded.portfolio_skills).to be_empty
    end
  end

  context 'when a skill entry is missing its level' do
    let(:response) do
      {
        'configured_skills' => [
          {
            'skill_id' => 'SK-ENG-001',
            'skill_label' => 'React / Frontend Development Core',
            'level' => 3,
            'confidence' => 'high',
            'evidence' => ['A quote.'],
            'competency_summary' => 'Summary.'
          },
          {
            'skill_id' => 'sk-eng-001',
            'skill_label' => 'Incomplete entry',
            'confidence' => 'low',
            'evidence' => ['A quote.'],
            'competency_summary' => 'Summary.'
          }
        ]
      }
    end

    it 'fails without leaving half-written skills behind' do
      expect { portfolio }.to raise_error(ArgumentError)

      reloaded = session.portfolio.reload
      expect(reloaded.generation_status).to eq('failed')
      expect(reloaded.generation_error).to match(/missing level/)
      expect(reloaded.portfolio_skills).to be_empty
    end
  end
end
