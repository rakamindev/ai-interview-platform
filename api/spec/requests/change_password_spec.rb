# frozen_string_literal: true

require 'rails_helper'

# Admins hand out temporary passwords, so every user must be able to change
# their own password (verified against the current one).
RSpec.describe 'Change password', type: :request do
  let!(:org) { create(:organization, scheme: 'test-corp', identifier: 'test-corp', name: 'Test Corp', host: 'localhost') }
  let(:original_password) { SecureRandom.alphanumeric(12) }
  let(:new_password) { SecureRandom.alphanumeric(12) }
  let(:wrong_password) { SecureRandom.alphanumeric(14) }
  let!(:user) { create(:user, email: 'assessor@test-corp.dev', password: original_password, role: 'assessor') }
  let(:token) { JsonWebToken.encode({ user_id: user.id, role: 'assessor', scheme: 'test-corp' }) }
  let(:auth) { { 'Authorization' => "Bearer #{token}" } }

  it 'changes the password when the current password is correct' do
    post '/api/v1/auth/change_password',
         params: { current_password: original_password, password: new_password },
         headers: auth

    expect(response).to have_http_status(:ok)
    expect(user.reload.authenticate(new_password)).to be_truthy
  end

  it 'rejects a wrong current password' do
    post '/api/v1/auth/change_password',
         params: { current_password: wrong_password, password: new_password },
         headers: auth

    # 422 (not 401) so the frontend interceptor does not log the user out.
    expect(response).to have_http_status(:unprocessable_entity)
    expect(user.reload.authenticate(original_password)).to be_truthy
  end

  it 'rejects a blank new password' do
    post '/api/v1/auth/change_password',
         params: { current_password: original_password, password: '' },
         headers: auth

    expect(response).to have_http_status(:unprocessable_entity)
  end

  it 'requires authentication' do
    post '/api/v1/auth/change_password',
         params: { current_password: original_password, password: new_password }

    expect(response).to have_http_status(:unauthorized)
  end
end
