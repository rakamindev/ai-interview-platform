# frozen_string_literal: true

require 'rails_helper'

# Recording a failure class is worthless if the assessor cannot read it back.
# These specs cover the two places the interface actually looks: the session
# detail endpoint, and the assessment list whose rows used to say nothing more
# than "Last: failed".
RSpec.describe 'Session failure reporting', type: :request do
  include TenantHelpers

  let!(:organization) { create(:organization) }
  let!(:assessor)     { create(:user, role: 'admin') }
  let(:headers)       { auth_headers(assessor, organization) }

  # Ending the session through the real service rather than by writing the
  # column directly, so the spec breaks if the classification ever stops
  # reaching the database — which is the whole point of it being visible.
  let(:failed_session) do
    create(:session, :active, tenant_id: organization.id).tap do |s|
      allow(PortfolioGeneratorWorker).to receive(:perform_async)
      Sessions::EndHandler.new(s).call(reason: 'error', failure_class: 'transient')
    end
  end

  describe 'GET /api/v1/sessions/:id' do
    it 'tells the assessor which class of failure ended the session' do
      get "/api/v1/sessions/#{failed_session.id}", headers: headers

      expect(response).to have_http_status(:ok)
      expect(json_response.dig('session', 'failure_class')).to eq('transient')
    end

    it 'reports no class for a session that ended cleanly' do
      clean = create(:session, :ended, tenant_id: organization.id)

      get "/api/v1/sessions/#{clean.id}", headers: headers

      expect(response).to have_http_status(:ok)
      expect(json_response.dig('session', 'failure_class')).to be_nil
    end
  end

  describe 'GET /api/v1/assessments' do
    it 'carries the class onto the summary the assessment list renders' do
      # The session has to exist before the request, not be created lazily
      # inside the assertion afterwards — otherwise the list is fetched while
      # there is nothing yet to list, and this would fail for the wrong reason.
      assessment_id = failed_session.assessment_id

      get '/api/v1/assessments', headers: headers

      latest = json_response['assessments'].find { |a| a['id'] == assessment_id }
                                            &.dig('latest_session')

      expect(latest).to be_present
      expect(latest['end_reason']).to eq('error')
      expect(latest['failure_class']).to eq('transient')
    end
  end
end
