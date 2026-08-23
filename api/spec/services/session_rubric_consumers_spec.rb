# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'session rubric consumers' do
  let(:assessment) { create(:assessment, name: 'Original Role') }
  let!(:skill) do
    create(:assessment_skill,
           assessment:,
           display_order: 0,
           skill_id: 'react',
           skill_label: 'Original Skill',
           l3_anchor: 'Original L3 anchor')
  end
  let(:version) { Assessments::VersionPublisher.new(assessment).call }
  let(:session) do
    Session.create!(
      assessment:,
      assessment_version: version,
      tenant_id: assessment.tenant_id,
      candidate_name: 'Candidate'
    )
  end

  before do
    session

    assessment.with_lock do
      assessment.update!(name: 'Changed Template Role')
      skill.update!(skill_label: 'Changed Template Skill', l3_anchor: 'Changed template L3 anchor')
      assessment.increment!(:rubric_version)
    end
  end

  it 'initializes coverage from the captured version rather than the changed template' do
    Sessions::StartHandler.new(session).call

    expect(session.coverage_maps.pluck(:skill_label)).to eq(['Original Skill'])
  end

  it 'uses captured skill anchors when building the portfolio prompt' do
    generator = Portfolios::Generator.new(session:, gemini_client: instance_double(Gemini::HttpClient))
    prompt = generator.send(:build_prompt)

    expect(prompt).to include('ROLE BEING ASSESSED: Original Role')
    expect(prompt).to include('SKILL: Original Skill')
    expect(prompt).to include('L3 — Original L3 anchor')
    expect(prompt).not_to include('Changed Template Role')
    expect(prompt).not_to include('Changed Template Skill')
  end

  it 'uses the mutable template only for legacy sessions' do
    legacy_session = Session.create!(assessment:, tenant_id: assessment.tenant_id)

    expect(session.rubric_status).to eq('captured')
    expect(session.rubric).to eq(version)
    expect(legacy_session.rubric_status).to eq('legacy')
    expect(legacy_session.rubric).to eq(assessment)
  end
end
