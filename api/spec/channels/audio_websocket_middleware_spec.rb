# frozen_string_literal: true

require 'rails_helper'

RSpec.describe AudioWebSocketMiddleware do
  before do
    @organization = Organization.create!(
      name: 'Test Org', scheme: 'test-org', identifier: 'test-org', host: 'test-org.test'
    )
    within_organization do
      @assessment = Assessment.new(
        name: 'Jr. Backend Engineer', time_limit_min: 30, created_by: 1, system_prompt: 'Test prompt',
        assessment_skills_attributes: [skill_attributes(skill_label: 'RESTful API Design')]
      )
      @assessment.save!
      @session = Session.new(assessment: @assessment, candidate_name: 'Test Candidate A')
      @session.save!
    end
    @socket = Class.new do
      attr_reader :sent, :closed

      def initialize
        @sent = []
        @closed = false
      end

      def send(message)
        @sent << JSON.parse(message)
      end

      def close
        @closed = true
      end
    end.new
  end

  def open_interview
    env = Rack::MockRequest.env_for("/ws/sessions/#{@session.id}/audio?token=#{@session.invite_token}")
    described_class.new(nil).send(:handle_browser_open, env, @session.id.to_s, @socket,
                                  described_class::ConnectionState.new)
  end

  describe 'when the interview cannot start' do
    it 'records assessment_invalid with a short reason when the assessment has a duplicate' do
      @assessment.assessment_skills.create!(skill_attributes(skill_label: 'RESTful API Design', display_order: 1))

      open_interview

      @session.reload
      expect(@session.status).to eq('pending')
      expect(@session.failure_code).to eq('assessment_invalid')
      expect(@session.failure_detail).to eq('duplicate skills')
    end

    it 'records start_failed without the exception text for an unexpected error' do
      allow_any_instance_of(Sessions::StartHandler).to receive(:call).and_raise(RuntimeError, 'boom: internal detail')

      open_interview

      @session.reload
      expect(@session.failure_code).to eq('start_failed')
      expect(@session.failure_detail).to be_nil
    end

    it 'tells the candidate the failure is final, without internal details, then closes' do
      @assessment.assessment_skills.create!(skill_attributes(skill_label: 'RESTful API Design', display_order: 1))

      open_interview

      expect(@socket.sent).to eq(
        [{ 'type' => 'error', 'code' => 'assessment_invalid', 'recoverable' => false,
           'message' => "This interview can't start right now. Please contact the person who invited you." }]
      )
      expect(@socket.closed).to eq(true)
    end
  end

  describe 'when the candidate does not come back within the grace period' do
    def expire_grace_period
      state = described_class::ConnectionState.new
      state.session = @session
      described_class.new(nil).send(:end_after_grace_period, state)
    end

    it 'ends a running interview as candidate_disconnected' do
      @session.update!(status: 'active', started_at: 5.minutes.ago)

      expire_grace_period

      @session.reload
      expect(@session.status).to eq('ended')
      expect(@session.failure_code).to eq('candidate_disconnected')
    end

    it 'leaves an interview that never started pending and retryable' do
      @session.record_failure!('assessment_invalid', 'duplicate skills')

      expire_grace_period

      @session.reload
      expect(@session.status).to eq('pending')
      expect(@session.failure_code).to eq('assessment_invalid')
    end
  end
end
