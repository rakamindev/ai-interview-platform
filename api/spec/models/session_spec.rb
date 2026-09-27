# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Session, type: :model do
  before do
    @organization = Organization.create!(
      name: 'Test Org', scheme: 'test-org', identifier: 'test-org', host: 'test-org.test'
    )
    within_organization do
      assessment = Assessment.new(name: 'Jr. Backend Engineer', time_limit_min: 30, created_by: 1)
      assessment.save!
      @session = described_class.new(assessment: assessment, candidate_name: 'Test Candidate A')
      @session.save!
    end
  end

  describe 'record_failure!' do
    it 'stores the failure code, detail and time without changing the status' do
      @session.record_failure!('assessment_invalid', "Skill 'RESTful API Design' is listed more than once")

      @session.reload
      expect(@session.failure_code).to eq('assessment_invalid')
      expect(@session.failure_detail).to eq("Skill 'RESTful API Design' is listed more than once")
      expect(@session.failed_at).to be_present
      expect(@session.status).to eq('pending')
    end

    it 'keeps only the latest failure when it fails again' do
      @session.record_failure!('start_failed')
      @session.record_failure!('assessment_invalid', 'second attempt')

      @session.reload
      expect(@session.failure_code).to eq('assessment_invalid')
      expect(@session.failure_detail).to eq('second attempt')
    end

    it 'returns error when the failure code is unknown' do
      expect { @session.record_failure!('network_glitch') }.to raise_error(ActiveRecord::RecordInvalid)
    end
  end

  describe 'clear_failure!' do
    it 'removes a recorded failure' do
      @session.record_failure!('start_failed')
      @session.clear_failure!

      @session.reload
      expect(@session.failure_code).to be_nil
      expect(@session.failure_detail).to be_nil
      expect(@session.failed_at).to be_nil
    end
  end

  describe 'failure_message' do
    it 'describes the failure for the assessor, including the short reason' do
      @session.record_failure!('assessment_invalid', 'duplicate skills')

      expect(@session.failure_message).to eq('Assessment needs fixing (duplicate skills).')
    end

    it 'describes the failure without a detail' do
      @session.record_failure!('ai_connection_lost')

      expect(@session.failure_message).to eq('AI interviewer connection lost.')
    end

    it 'returns nil when no failure was recorded' do
      expect(@session.failure_message).to be_nil
    end
  end
end
