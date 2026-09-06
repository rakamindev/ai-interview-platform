# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Portfolios::Generator do
  include FactoryHelpers

  let(:org)        { create_org!(name: 'Test', scheme: 'test-corp') }
  let(:assessment) { create(:assessment, tenant_id: org.id) }
  let(:session)    { create(:session, assessment: assessment, tenant_id: org.id) }
  let(:portfolio)  { create(:portfolio, session: session, tenant_id: org.id) }

  describe '#save_skills (private)' do
    subject(:generator) { described_class.new(session: session) }

    context 'ketika LLM return nil level dengan not_assessed: true (skill tidak diprobe)' do
      let(:llm_response) do
        {
          'configured_skills' => [
            {
              'skill_id'           => 'SK-TEST-001',
              'skill_label'        => 'React',
              'level'              => nil,
              'not_assessed'       => true,
              'confidence'         => nil,
              'evidence'           => [],
              'competency_summary' => 'Tidak sempat diprobe.'
            }
          ],
          'discovered_skills' => []
        }
      end

      it 'menyimpan skill dengan ai_level nil, BUKAN fabricated L1' do
        generator.send(:save_skills, portfolio, llm_response)
        skill = portfolio.portfolio_skills.find_by(skill_label: 'React')
        expect(skill).to be_present
        expect(skill.ai_level).to be_nil # NOT 1!
        expect(skill.not_assessed).to be(true)
        expect(skill.evidence).to eq([])
      end
    end

    context 'ketika LLM return nil level tanpa explicit not_assessed flag (defensive)' do
      let(:llm_response) do
        {
          'configured_skills' => [
            {
              'skill_id'           => 'SK-TEST-002',
              'skill_label'        => 'Go',
              'level'              => nil,
              'confidence'         => nil,
              'evidence'           => [],
              'competency_summary' => ''
            }
          ],
          'discovered_skills' => []
        }
      end

      it 'memperlakukan nil level sebagai not_assessed secara defensif' do
        generator.send(:save_skills, portfolio, llm_response)
        skill = portfolio.portfolio_skills.find_by(skill_label: 'Go')
        expect(skill.ai_level).to be_nil
        expect(skill.not_assessed).to be(true)
      end
    end

    context 'ketika LLM return level valid (3)' do
      let(:llm_response) do
        {
          'configured_skills' => [
            {
              'skill_id'           => 'SK-TEST-003',
              'skill_label'        => 'System Design',
              'level'              => 3,
              'not_assessed'       => false,
              'confidence'         => 'high',
              'evidence'           => ['Kandidat menjelaskan load balancing dengan baik.'],
              'competency_summary' => 'Strong understanding.'
            }
          ],
          'discovered_skills' => []
        }
      end

      it 'menyimpan skill dengan ai_level benar dan not_assessed false' do
        generator.send(:save_skills, portfolio, llm_response)
        skill = portfolio.portfolio_skills.find_by(skill_label: 'System Design')
        expect(skill.ai_level).to eq(3)
        expect(skill.not_assessed).to be(false)
        expect(skill.evidence).to eq(['Kandidat menjelaskan load balancing dengan baik.'])
      end
    end

    context 'ketika skill_id dari LLM melebihi batas 50 karakter (PG::StringDataRightTruncation)' do
      let(:long_skill_id) { 'containerization-&-operations-(docker-engine,-image-optimization,-&-ecosystem)' }
      let(:llm_response) do
        {
          'configured_skills' => [
            {
              'skill_id'           => long_skill_id,
              'skill_label'        => 'Containerization & Operations',
              'level'              => 2,
              'not_assessed'       => false,
              'confidence'         => 'medium',
              'evidence'           => ['Docker quote'],
              'competency_summary' => 'Understands containerization.'
            }
          ],
          'discovered_skills' => []
        }
      end

      it 'berhasil menyimpan tanpa error ValueTooLong dan memotong/menyesuaikan skill_id' do
        expect {
          generator.send(:save_skills, portfolio, llm_response)
        }.not_to raise_error

        skill = portfolio.portfolio_skills.find_by(skill_label: 'Containerization & Operations')
        expect(skill).to be_present
        expect(skill.skill_id.length).to be <= 50
      end
    end
  end

  describe '#call' do
    subject(:generator) { described_class.new(session: session) }

    context 'ketika interview session memiliki 0 transcript turns (kandidat tidak berinteraksi)' do
      before do
        create(:assessment_skill, assessment: assessment, skill_label: 'TypeScript', skill_id: 'SK-ENG-001')
      end

      it 'menghasilkan portfolio complete dengan semua skill not_assessed tanpa crash' do
        result = generator.call
        expect(result.generation_status).to eq('complete')
        expect(result.portfolio_skills.count).to eq(1)
        skill = result.portfolio_skills.first
        expect(skill.not_assessed).to be(true)
        expect(skill.ai_level).to be_nil
        expect(skill.competency_summary).to include('0 turns')
      end
    end
  end
end


