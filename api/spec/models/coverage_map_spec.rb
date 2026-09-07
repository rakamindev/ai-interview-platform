# frozen_string_literal: true

require 'rails_helper'

RSpec.describe CoverageMap do
  let(:assessment) { create(:assessment, :with_prd02_skills) }
  let(:session)    { create(:session, assessment: assessment) }

  it 'is created through a tenant-scoped session' do
    map = create(:coverage_map, session: session, skill_label: 'React')

    expect(map).to be_persisted
    expect(map.session.tenant_id).to eq(TenantContext.organization.id)
  end

  it 'defaults to the start of the ladder' do
    map = described_class.new(session: session, skill_label: 'React')

    expect(map.state).to eq('not_yet')
    expect(map.probe_count).to eq(0)
  end

  it 'rejects a state outside the vocabulary' do
    map = build(:coverage_map, session: session, state: 'discovered')

    expect(map).not_to be_valid
    expect(map.errors[:state]).to be_present
  end

  it 'rejects a negative probe_count' do
    expect(build(:coverage_map, session: session, probe_count: -1)).not_to be_valid
  end

  # The uniqueness index is on (session_id, skill_label), not skill_id — so two
  # taxonomy skills that happen to share a label collide, and a model that spells
  # a discovered skill slightly differently slips through as a separate row.
  it 'enforces uniqueness on label rather than on skill_id' do
    create(:coverage_map, session: session, skill_id: 'SK-ENG-001', skill_label: 'System Design')

    duplicate_label = build(:coverage_map, session: session, skill_id: 'SK-ENG-999', skill_label: 'System Design')

    expect { duplicate_label.save!(validate: false) }.to raise_error(ActiveRecord::RecordNotUnique)
  end

  describe 'scopes' do
    before do
      create(:coverage_map, session: session, skill_label: 'React')
      create(:coverage_map, :discovered, session: session, skill_label: 'Micro-frontends')
    end

    it 'separates configured skills from discovered ones' do
      expect(session.coverage_maps.configured.pluck(:skill_label)).to eq(['React'])
      expect(session.coverage_maps.discovered.pluck(:skill_label)).to eq(['Micro-frontends'])
    end
  end
end
