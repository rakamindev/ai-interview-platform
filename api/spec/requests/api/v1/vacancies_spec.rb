# frozen_string_literal: true

require 'rails_helper'

# Regression contract for the vacancy list endpoint — the backend spec deferred
# from the `fix-vacancy-list-skills-contract` change: index MUST include each
# vacancy's skills (label + expected level) and load them without an N+1.
RSpec.describe 'Api::V1::Vacancies', type: :request do
  let(:organization) { create(:organization, scheme: 'test-corp') }
  let(:admin) { create(:admin_user) }
  let(:headers) { auth_headers(scheme: organization.scheme, user: admin) }

  describe 'GET /api/v1/vacancies' do
    it 'returns the tenant vacancies including their skills' do
      vacancy = create(:vacancy, tenant_id: organization.id, role_title: 'Backend Engineer')
      create(:vacancy_skill, vacancy: vacancy, skill_label: 'SQL', expected_level: 4)

      get '/api/v1/vacancies', headers: headers

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      vacancies = body['vacancies'] || body.dig('data', 'vacancies')
      row = vacancies.find { |v| v['role_title'] == 'Backend Engineer' }

      expect(row).to be_present
      expect(row['skills']).to be_present
      expect(row['skills'].first).to include('skill_label' => 'SQL', 'expected_level' => 4)
    end

    it 'loads skills without a per-vacancy query (no N+1)' do
      3.times do |i|
        v = create(:vacancy, tenant_id: organization.id, role_title: "Role #{i}")
        create(:vacancy_skill, vacancy: v)
      end

      queries = []
      sub = ActiveSupport::Notifications.subscribe('sql.active_record') do |*, payload|
        next if payload[:name].to_s =~ /SCHEMA|TRANSACTION/

        queries << payload[:sql]
      end
      get '/api/v1/vacancies', headers: headers
      ActiveSupport::Notifications.unsubscribe(sub)

      skill_queries = queries.select { |q| q.include?('vacancy_skills') }
      expect(skill_queries.size).to be <= 1
    end

    it 'rejects requests without a verified token' do
      get '/api/v1/vacancies'
      expect(response.status).to be_in([401, 403])
    end

    it 'ignores the X-Tenant-Scheme header and uses the verified token tenant' do
      create(:vacancy, tenant_id: organization.id, role_title: 'Backend Engineer')

      get '/api/v1/vacancies', headers: headers.merge('X-Tenant-Scheme' => 'other-tenant')

      expect(response).to have_http_status(:ok)
      labels = JSON.parse(response.body)['vacancies'].map { |v| v['role_title'] }
      expect(labels).to include('Backend Engineer')
    end

    it "does not leak another tenant's vacancies" do
      other = create(:organization, scheme: 'other-corp')
      create(:vacancy, tenant_id: other.id, role_title: 'Other Tenant Vacancy')
      create(:vacancy, tenant_id: organization.id, role_title: 'Mine')

      get '/api/v1/vacancies', headers: headers
      labels = JSON.parse(response.body)['vacancies'].map { |v| v['role_title'] }
      expect(labels).to include('Mine')
      expect(labels).not_to include('Other Tenant Vacancy')
    end
  end
end
