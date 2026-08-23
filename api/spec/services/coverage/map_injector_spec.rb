# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Coverage::MapInjector, type: :model do
  let(:session) { create(:session, :active, started_at: 10.minutes.ago) }
  let(:assessment) { session.assessment }
  let(:injector) { described_class.new(session) }

  before do
    assessment.update(time_limit_min: 60)
  end

  describe '#injection_text' do
    let!(:skill1) { create(:coverage_map, session: session, skill_label: 'React', state: 'not_yet', probe_count: 0) }
    let!(:skill2) { create(:coverage_map, session: session, skill_label: 'Node.js', state: 'initiated', probe_count: 1) }

    it 'returns formatted coverage map text' do
      text = injector.injection_text
      expect(text).to start_with('[COVERAGE_MAP]')
      expect(text).to end_with('[/COVERAGE_MAP]')
      expect(text).to include('skills')
      expect(text).to include('time_remaining_minutes')
      expect(text).to include('pacing')
    end

    it 'includes correct skills_remaining count' do
      text = injector.injection_text
      data = JSON.parse(text.gsub("[COVERAGE_MAP]\n", '').gsub("\n[/COVERAGE_MAP]", ''))
      expect(data['skills_remaining']).to eq(2)
    end
  end

  describe '#all_covered?' do
    context 'when all configured skills are covered' do
      before do
        create(:coverage_map, :covered, session: session, skill_label: 'React')
        create(:coverage_map, :covered, session: session, skill_label: 'Node.js')
      end

      it 'returns true' do
        expect(injector.all_covered?).to be true
      end
    end

    context 'when some configured skills are not covered' do
      before do
        create(:coverage_map, :covered, session: session, skill_label: 'React')
        create(:coverage_map, :initiated, session: session, skill_label: 'Node.js')
      end

      it 'returns false' do
        expect(injector.all_covered?).to be false
      end
    end

    context 'when no configured skills exist' do
      it 'returns false' do
        expect(injector.all_covered?).to be false
      end
    end

    context 'when discovered skills are in initiated state' do
      before do
        create(:coverage_map, :covered, session: session, skill_label: 'React')
        create(:coverage_map, :discovered, :initiated, session: session, skill_label: 'New Skill')
      end

      it 'returns false' do
        expect(injector.all_covered?).to be false
      end
    end
  end

  describe '#coverage_fingerprint' do
    let!(:skill1) { create(:coverage_map, session: session, state: 'not_yet', probe_count: 0) }
    let!(:skill2) { create(:coverage_map, session: session, state: 'initiated', probe_count: 1) }

    it 'returns deterministic MD5 hash' do
      fp1 = injector.coverage_fingerprint
      fp2 = injector.coverage_fingerprint
      expect(fp1).to eq(fp2)
      expect(fp1.length).to eq(32)
    end

    it 'changes when coverage state changes' do
      fp1 = injector.coverage_fingerprint
      skill1.update!(state: 'partial', probe_count: 3)
      fp2 = injector.coverage_fingerprint
      expect(fp1).not_to eq(fp2)
    end
  end

  describe 'pacing calculation' do
    it 'returns ahead when avg_min >= 5.0' do
      session.update(started_at: 5.minutes.ago)
      text = injector.injection_text
      data = JSON.parse(text.gsub("[COVERAGE_MAP]\n", '').gsub("\n[/COVERAGE_MAP]", ''))
      expect(data['pacing']).to eq('ahead')
    end

    it 'returns critical when avg_min < 1.5' do
      session.update(started_at: 55.minutes.ago)
      create(:coverage_map, session: session, skill_label: 'React', state: 'not_yet')
      create(:coverage_map, session: session, skill_label: 'Node.js', state: 'not_yet')
      text = injector.injection_text
      data = JSON.parse(text.gsub("[COVERAGE_MAP]\n", '').gsub("\n[/COVERAGE_MAP]", ''))
      expect(data['pacing']).to be_in(%w[behind critical])
    end
  end
end
