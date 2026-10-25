# frozen_string_literal: true

require 'rails_helper'

# F-03 phase 2 (decision evolution A → D): tenancy comes from the account's
# organization relation, not from anything typed at login.
#
#   AC#1 — a user without an assigned organization is rejected explicitly
#   AC#2 — login derives the scheme from the account's organization
#   AC#4 — X-Tenant-Scheme header is ignored at login (no override)
#   AC#5 — users.tenant_id exists, NOT NULL, FK to organizations
#   regression — wrong credentials still 401
RSpec.describe 'Authentication API (F-03 phase 2)', type: :request do
  let(:org_a) do
    Organization.create!(
      name: 'Tenant A',
      scheme: 'tenant-a',
      identifier: 'tenant-a',
      host: 'tenant-a.test.local'
    )
  end

  let(:org_b) do
    Organization.create!(
      name: 'Tenant B',
      scheme: 'tenant-b',
      identifier: 'tenant-b',
      host: 'tenant-b.test.local'
    )
  end

  let!(:admin_a) do
    User.create!(email: 'assessor-a@test.corp', password: 'Password123!', role: 'admin', organization: org_a)
  end

  let!(:admin_b) do
    User.create!(email: 'assessor-b@test.corp', password: 'Password123!', role: 'admin', organization: org_b)
  end

  def login(email:, password: 'Password123!', headers: {})
    post '/api/v1/auth/login',
         params: { email:, password: }.to_json,
         headers: { 'Content-Type' => 'application/json' }.merge(headers)
  end

  describe 'AC#1 — account without an organization is rejected' do
    it 'returns 401 "Account is not assigned to an organization" and no token' do
      # The DB already makes an org-less user structurally impossible (NOT NULL
      # + FK, AC#5), so this simulates the edge via a broken organization lookup
      # — the controller guard is the last line of defense that must exist.
      allow_any_instance_of(User).to receive(:organization).and_return(nil)

      login(email: admin_a.email)

      expect(response).to have_http_status(:unauthorized)
      body = JSON.parse(response.body)
      expect(body.dig('error', 'message')).to eq('Account is not assigned to an organization')
      expect(body['token']).to be_nil
    end
  end

  describe 'AC#2 — login derives the scheme from the account organization (implicit tenant)' do
    it 'issues a token whose scheme claim matches the account organization' do
      login(email: admin_b.email)

      expect(response).to have_http_status(:ok)
      claims = JsonWebToken.decode_without_verification(JSON.parse(response.body)['token'])
      expect(claims[:scheme]).to eq('tenant-b')
    end

    it 'two organizations exist and each user always lands in their own tenant' do
      org_a && org_b
      login(email: admin_a.email)
      claims = JsonWebToken.decode_without_verification(JSON.parse(response.body)['token'])
      expect(claims[:scheme]).to eq('tenant-a')

      login(email: admin_b.email)
      claims = JsonWebToken.decode_without_verification(JSON.parse(response.body)['token'])
      expect(claims[:scheme]).to eq('tenant-b')
    end
  end

  describe 'AC#4 — X-Tenant-Scheme header cannot override the account tenant' do
    it 'ignores a conflicting header — scheme still comes from the account' do
      org_a && org_b
      login(email: admin_b.email, headers: { 'X-Tenant-Scheme' => org_a.scheme })

      expect(response).to have_http_status(:ok)
      claims = JsonWebToken.decode_without_verification(JSON.parse(response.body)['token'])
      expect(claims[:scheme]).to eq('tenant-b')
      expect(claims[:scheme]).not_to eq('tenant-a')
    end

    it 'does not require any tenant header anymore (clean login)' do
      login(email: admin_a.email)

      expect(response).to have_http_status(:ok)
    end
  end

  describe 'AC#5 — migration safety (users.tenant_id)' do
    it 'exists, is NOT NULL and has a FK to organizations' do
      column = User.columns_hash['tenant_id']
      expect(column).not_to be_nil
      expect(column.null).to be(false)

      fk = ActiveRecord::Base.connection.foreign_keys('users').find { |k| k.column == 'tenant_id' }
      expect(fk).not_to be_nil
      expect(fk.to_table).to eq('organizations')
    end

    it 'model-level: creating a user without an organization is refused' do
      expect do
        User.create!(email: 'noorg@test.corp', password: 'Password123!', role: 'admin')
      end.to raise_error(ActiveRecord::RecordInvalid)
    end
  end

  describe 'regression — wrong credentials keep the existing 401 behavior' do
    it 'still returns Invalid email or password with a wrong password' do
      login(email: admin_b.email, password: 'WrongPassword1')

      expect(response).to have_http_status(:unauthorized)
      expect(JSON.parse(response.body).dig('error', 'message')).to eq('Invalid email or password')
    end

    it 'still returns Invalid email or password for an unknown email' do
      login(email: 'ghost@test.corp')

      expect(response).to have_http_status(:unauthorized)
      expect(JSON.parse(response.body).dig('error', 'message')).to eq('Invalid email or password')
    end
  end
end