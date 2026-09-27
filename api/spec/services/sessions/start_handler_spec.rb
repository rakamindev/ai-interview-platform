# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Sessions::StartHandler do
  before do
    @organization = Organization.create!(
      name: 'Test Org', scheme: 'test-org', identifier: 'test-org', host: 'test-org.test'
    )
    within_organization do
      @assessment = Assessment.new(
        name: 'Jr. Backend Engineer', time_limit_min: 30, created_by: 1,
        assessment_skills_attributes: [skill_attributes(skill_label: 'RESTful API Design')]
      )
      @assessment.save!
      @session = Session.new(assessment: @assessment, candidate_name: 'Test Candidate A')
      @session.save!
    end
  end

  it 'activates the session and creates one coverage map per skill' do
    described_class.new(@session).call

    @session.reload
    expect(@session.status).to eq('active')
    expect(@session.coverage_maps.pluck(:skill_label)).to eq(['RESTful API Design'])
  end

  it 'schedules a deadline for the time limit plus a buffer' do
    described_class.new(@session).call

    job = SessionDeadlineWorker.jobs.last
    expect(job['args']).to eq([@session.id])
    expect(Time.zone.at(job['at'])).to be_within(5.seconds).of(@session.reload.started_at + 30.minutes + 5.minutes)
  end

  it 'clears a failure recorded by an earlier attempt' do
    @session.record_failure!('assessment_invalid', 'earlier attempt')

    described_class.new(@session).call

    expect(@session.reload.failure_code).to be_nil
  end

  it 'raises InvalidAssessment with a short reason when the assessment already has a duplicate' do
    @assessment.assessment_skills.create!(skill_attributes(skill_label: 'RESTful API Design', display_order: 1))

    expect { described_class.new(@session).call }
      .to raise_error(described_class::InvalidAssessment, 'duplicate skills')

    @session.reload
    expect(@session.status).to eq('pending')
    expect(@session.coverage_maps.count).to eq(0)
  end

  it 'raises InvalidAssessment with a generic reason when the assessment is invalid for another reason' do
    @assessment.update_column(:name, '')

    expect { described_class.new(@session).call }
      .to raise_error(described_class::InvalidAssessment, 'invalid configuration')
  end
end
