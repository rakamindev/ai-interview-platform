require 'active_support/core_ext/object/blank'
# Minimal controller boundary, no Rails environment or credentials loaded.
module Api
  module V1
    class ApiController
      def self.authorize_auth_token!(*); end
      def self.skip_before_action(*); end
      def self.before_action(*); end
    end
  end
end
require_relative '../../app/controllers/api/v1/sessions_controller'

RSpec.describe Api::V1::SessionsController do
  it 'exposes terminal reason and original remaining time to the public candidate screen' do
    now = Time.utc(2026, 1, 1, 12)
    allow(Time).to receive(:current).and_return(now)
    session = double('session', id: 123, tenant_id: 7, assessment_id: 8, status: 'active', end_reason: nil, started_at: now - 120)
    assessment = double('assessment', name: 'Synthetic interview', time_limit_min: 45)
    stub_const('Session', Class.new); stub_const('Assessment', Class.new)
    allow(Session).to receive_message_chain(:unscoped, :find_by).and_return(session)
    allow(Assessment).to receive_message_chain(:unscoped, :where, :find_by).and_return(assessment)
    controller = described_class.new
    allow(controller).to receive(:params).and_return({token: 'synthetic-invite'})
    payload = nil
    allow(controller).to receive(:json_response) { |**data| payload = data }
    controller.candidate_info
    expect(payload).to include(end_reason: nil, remaining_seconds: 2580)
    allow(session).to receive(:status).and_return('ended')
    allow(session).to receive(:end_reason).and_return('error')
    controller.candidate_info
    expect(payload).to include(session_status: 'ended', end_reason: 'error')
  end
end
