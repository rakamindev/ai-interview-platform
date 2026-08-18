# frozen_string_literal: true

require 'rails_helper'

# ActionController::LogSubscriber writes `request.filtered_parameters` to the
# log at INFO, and production runs at INFO. Whatever survives filtering here is
# what an operator — or anyone who obtains the log file — gets to read.
RSpec.describe 'Parameter filtering in logs', type: :request do
  let(:org)     { create_organization }
  let!(:user)   { create_user(tenant: org) }
  let(:filtered) { request.filtered_parameters }

  describe 'POST /api/v1/auth/login' do
    it 'keeps the submitted password out of the logged parameters' do
      post '/api/v1/auth/login', params: { email: user.email, password: 'Password123!' }

      expect(filtered['password']).to eq('[FILTERED]')
      expect(filtered.to_s).not_to include('Password123!')
    end

    it 'keeps the email address out of the logged parameters' do
      post '/api/v1/auth/login', params: { email: user.email, password: 'wrong' }

      expect(filtered['email']).to eq('[FILTERED]')
      expect(filtered.to_s).not_to include(user.email)
    end
  end

  describe 'candidate routes carrying an invite token' do
    let(:assessment) { create_assessment(tenant: org) }
    let(:session)    { build_session(tenant: org, assessment: assessment) }

    it 'filters the invite token out of the logged parameters' do
      post "/api/v1/sessions/#{session.invite_token}/consent",
           params: { consent: { status: 'accepted' } }

      expect(response).to have_http_status(:ok)
      expect(filtered['token']).to eq('[FILTERED]')
      expect(filtered.to_s).not_to include(session.invite_token)
    end

    # Documents the limit of this defence rather than implying it does not
    # exist: Rails filters the query string of `filtered_path`, never a path
    # segment. Moving the token out of the URL is the real fix and is listed as
    # a follow-up. If this expectation ever flips, the follow-up landed and the
    # comment above it should go.
    it 'still exposes the invite token in the request line' do
      post "/api/v1/sessions/#{session.invite_token}/consent",
           params: { consent: { status: 'accepted' } }

      expect(request.filtered_path).to include(session.invite_token)
    end
  end
end
