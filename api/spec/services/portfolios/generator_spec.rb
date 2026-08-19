# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Portfolios::Generator do
  let(:org) { create(:organization) }

  def build_scenario(assessed_json:)
    assessment = with_tenant(org) do
      a = create(:assessment, :with_skills, tenant: org)
      a
    end
    sess = with_tenant(org) { create(:session, assessment: assessment, tenant: org) }
    port = with_tenant(org) do
      create(:portfolio, session: sess)
      sess.portfolio
    end

    fake_gemini = instance_double(Gemini::HttpClient)
    allow(fake_gemini).to receive(:generate_content).and_return(assessed_json)

    [sess, port, fake_gemini]
  end

  describe '#call with an incomplete Gemini payload' do
    it 'stores honest "not assessed" rows instead of fabricating an L1' do
      sess, port, fake_gemini = build_scenario(assessed_json: {
        'configured_skills' => [
          {
            'skill_id' => 'SK-ENG-001',
            'skill_label' => 'React / Frontend Development Core',
            'level' => 3,
            'confidence' => 'high',
            'evidence' => ['"Built a real-time dashboard."'],
            'competency_summary' => 'Strong L3.'
          }
          # SK-SOFT-001 and SK-ENG-003 are intentionally omitted
        ],
        'discovered_skills' => []
      })

      generator = described_class.new(session: sess, gemini_client: fake_gemini)
      result = with_tenant(org) { generator.call }

      expect(result.generation_status).to eq('complete')
      skills = result.portfolio_skills.index_by(&:skill_label)

      react = skills['React / Frontend Development Core']
      expect(react).to be_assessed
      expect(react.ai_level).to eq(3)

      expect(skills['Communication']).not_to be_assessed
      expect(skills['Communication'].ai_level).to be_nil
      expect(skills['Communication'].ai_confidence).to be_nil
      expect(skills['Communication'].competency_summary).to eq(PortfolioSkill.not_assessed_summary)

      expect(skills['System Design & Architecture']).not_to be_assessed
    end

    it 'treats an invalid confidence as unassessed rather than crashing' do
      sess, port, fake_gemini = build_scenario(assessed_json: {
        'configured_skills' => [
          {
            'skill_id' => 'SK-ENG-001',
            'skill_label' => 'React / Frontend Development Core',
            'level' => 3,
            'confidence' => 'very high', # invalid enum value
            'evidence' => ['"quote"'],
            'competency_summary' => 'Some summary.'
          }
        ],
        'discovered_skills' => []
      })

      generator = described_class.new(session: sess, gemini_client: fake_gemini)
      result = with_tenant(org) { generator.call }

      expect(result.generation_status).to eq('complete')
      react = result.portfolio_skills.find_by(skill_label: 'React / Frontend Development Core')
      expect(react).not_to be_assessed
      expect(react.ai_level).to be_nil
    end

    it 'stores discovered skills only when rateable' do
      sess, port, fake_gemini = build_scenario(assessed_json: {
        'configured_skills' => [
          {
            'skill_id' => 'SK-ENG-001',
            'skill_label' => 'React / Frontend Development Core',
            'level' => 3,
            'confidence' => 'high',
            'evidence' => ['"quote"'],
            'competency_summary' => 'Strong.'
          }
        ],
        'discovered_skills' => [
          {
            'skill_label' => 'Micro-frontend Architecture',
            'level' => 2,
            'confidence' => 'low',
            'evidence' => ['"We split into four apps."'],
            'competency_summary' => 'Hands-on experience, brief signal.'
          },
          {
            'skill_label' => 'Unrateable Discovery',
            'level' => nil,
            'confidence' => nil,
            'evidence' => [],
            'competency_summary' => nil
          }
        ]
      })

      generator = described_class.new(session: sess, gemini_client: fake_gemini)
      result = with_tenant(org) { generator.call }

      expect(result.generation_status).to eq('complete')
      labels = result.portfolio_skills.pluck(:skill_label)
      expect(labels).to include('Micro-frontend Architecture')
      expect(labels).not_to include('Unrateable Discovery')
    end
  end
end
