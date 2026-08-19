# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Coverage::MapInjector do
  let(:session) { create(:session, :active, started_at: 10.minutes.ago) }
  let!(:assessment) { session.assessment.update!(time_limit_min: 30); session.assessment }
  let!(:skill1) { create(:assessment_skill, assessment: assessment, skill_label: 'React', skill_id: 'sk-1', display_order: 1) }
  let!(:skill2) { create(:assessment_skill, assessment: assessment, skill_label: 'Ruby', skill_id: 'sk-2', display_order: 2) }
  let!(:map1) { create(:coverage_map, session: session, skill_label: 'React', skill_id: 'sk-1', state: 'not_yet', probe_count: 0) }
  let!(:map2) { create(:coverage_map, session: session, skill_label: 'Ruby', skill_id: 'sk-2', state: 'partial', probe_count: 2) }

  let(:injector) { described_class.new(session) }

  describe '#coverage_fingerprint' do
    it 'returns a consistent MD5 hex string' do
      fp1 = injector.coverage_fingerprint
      fp2 = injector.coverage_fingerprint
      expect(fp1).to eq(fp2)
      expect(fp1).to match(/\A[0-9a-f]{32}\z/)
    end

    it 'changes when coverage state changes' do
      fp1 = injector.coverage_fingerprint
      map1.update!(state: 'initiated')
      fp2 = injector.coverage_fingerprint
      expect(fp1).not_to eq(fp2)
    end
  end

  describe '#injection_text' do
    subject { injector.injection_text }

    it 'wraps payload in [COVERAGE_MAP] tags' do
      expect(subject).to start_with('[COVERAGE_MAP]')
      expect(subject).to end_with('[/COVERAGE_MAP]')
    end

    it 'includes skill information' do
      expect(subject).to include('React')
      expect(subject).to include('Ruby')
    end

    it 'includes time_remaining_minutes' do
      expect(subject).to include('time_remaining_minutes')
    end

    it 'includes skills_remaining count' do
      expect(subject).to include('skills_remaining')
    end
  end

  describe '#all_covered?' do
    it 'returns false when skills are not all covered' do
      expect(injector.all_covered?).to be false
    end

    it 'returns true when all configured skills are covered' do
      map1.update!(state: 'covered')
      map2.update!(state: 'covered')
      expect(injector.all_covered?).to be true
    end

    it 'returns false when configured maps are empty' do
      session.coverage_maps.destroy_all
      expect(injector.all_covered?).to be false
    end
  end
end
