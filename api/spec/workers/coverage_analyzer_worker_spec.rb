# frozen_string_literal: true

require 'rails_helper'

RSpec.describe CoverageAnalyzerWorker do
  before do
    @organization = Organization.create!(
      name: 'Test Org', scheme: 'test-org', identifier: 'test-org', host: 'test-org.test'
    )
    within_organization do
      assessment = Assessment.new(name: 'Jr. Backend Engineer', time_limit_min: 30, created_by: 1)
      assessment.save!
      @session = Session.new(assessment: assessment, candidate_name: 'Test Candidate A',
                             status: 'active', started_at: 5.minutes.ago)
      @session.save!
    end

    @analyzer = instance_double(Coverage::Analyzer, call: { skill_updates: [], discovered_skills: [] })
    allow(Coverage::Analyzer).to receive(:new).and_return(@analyzer)
  end

  it 'analyzes a turn only once when the same job runs twice' do
    described_class.new.perform(@session.id, 3)
    described_class.new.perform(@session.id, 3)

    expect(@analyzer).to have_received(:call).once
  end

  it 'skips a turn older than one already analyzed' do
    described_class.new.perform(@session.id, 5)
    described_class.new.perform(@session.id, 4)

    expect(@analyzer).to have_received(:call).once
  end

  it 'analyzes each new turn' do
    described_class.new.perform(@session.id, 1)
    described_class.new.perform(@session.id, 2)

    expect(@analyzer).to have_received(:call).twice
  end
end
