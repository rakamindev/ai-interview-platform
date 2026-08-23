# frozen_string_literal: true

require 'rails_helper'

# Verifies index endpoint caching:
#   - repeated requests are served from cache
#   - any write invalidates immediately (no stale rows)
#   - page/per_page variations get separate cache entries
#
# Uses a per-example MemoryStore (test env defaults to :null_store).
RSpec.describe 'Index endpoint caching', type: :request do
  let(:user) { create(:user, :admin) }
  let(:headers) { auth_headers(user) }

  around do |example|
    old_store = Rails.cache
    Rails.cache = ActiveSupport::Cache::MemoryStore.new
    example.run
  ensure
    Rails.cache = old_store
  end

  before { with_tenant }

  describe 'GET /api/v1/assessments' do
    def assessment_names
      get '/api/v1/assessments', headers: headers
      json_body['assessments'].map { |a| a['name'] }
    end

    it 'serves consistent fresh data after writes (no stale cache)' do
      create(:assessment, name: 'Before Write', tenant_id: 1)
      expect(assessment_names).to eq(['Before Write'])

      # Cached now — same response on repeat
      expect(assessment_names).to eq(['Before Write'])

      # A write must invalidate the cached page immediately
      create(:assessment, name: 'After Write', tenant_id: 1)
      expect(assessment_names).to contain_exactly('Before Write', 'After Write')
    end

    it 'invalidates when a session changes (latest_session is rendered)' do
      assessment = create(:assessment, name: 'With Session', tenant_id: 1)
      expect(assessment_names).to eq(['With Session'])

      # A previous request resets RequestStore — restore tenant context.
      with_tenant do
        session = create(:session, :active, assessment: assessment)
        get '/api/v1/assessments', headers: headers

        latest = json_body['assessments'].first['latest_session']
        expect(latest).to be_present
        expect(latest['id']).to eq(session.id)
      end
    end

    it 'uses separate cache entries per page' do
      2.times { |i| create(:assessment, name: "A#{i}", tenant_id: 1) }

      get '/api/v1/assessments?page=1&per_page=1', headers: headers
      first_page = json_body['assessments'].map { |a| a['name'] }
      expect(json_body['meta']['total_pages']).to eq(2)

      get '/api/v1/assessments?page=2&per_page=1', headers: headers
      second_page = json_body['assessments'].map { |a| a['name'] }

      expect(first_page).not_to eq(second_page)
    end

    it 'does not leak entries across tenants' do
      create(:assessment, name: 'Tenant One', tenant_id: 1)

      get '/api/v1/assessments', headers: headers
      expect(json_body['assessments'].size).to eq(1)

      # A genuinely different tenant (own org + JWT scheme) must never see
      # tenant one's cached page.
      other_org = create(:organization, scheme: 'other-corp')
      create(:assessment, name: 'Tenant Two', tenant_id: other_org.id)

      get '/api/v1/assessments', headers: auth_headers(user, 'admin', 'other-corp')
      expect(json_body['assessments'].map { |a| a['name'] }).to eq(['Tenant Two'])
    end
  end

  describe 'GET /api/v1/vacancies' do
    def vacancy_titles
      get '/api/v1/vacancies', headers: headers
      json_body['vacancies'].map { |v| v['role_title'] }
    end

    it 'serves consistent fresh data after writes (no stale cache)' do
      create(:vacancy, role_title: 'Role V1', tenant_id: 1)
      expect(vacancy_titles).to eq(['Role V1'])
      expect(vacancy_titles).to eq(['Role V1']) # cached

      create(:vacancy, role_title: 'Role V2', tenant_id: 1)
      expect(vacancy_titles).to contain_exactly('Role V1', 'Role V2')
    end

    it 'reflects updates and deletes immediately' do
      vacancy = create(:vacancy, role_title: 'Original', tenant_id: 1)
      vacancy_titles # warm cache

      with_tenant do
        vacancy.update!(role_title: 'Updated')
      end
      expect(vacancy_titles).to eq(['Updated'])

      with_tenant do
        vacancy.destroy!
      end
      expect(vacancy_titles).to be_empty
    end
  end
end
