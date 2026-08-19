# frozen_string_literal: true

require 'rails_helper'

# List-vs-detail contract for vacancies: list rows carry lightweight skill
# summaries (no taxonomy anchors); detail carries the l1–l5 anchors.
RSpec.describe 'Api::V1::Vacancies (list vs detail contract)', type: :request do
  let(:org) { create(:organization, scheme: 'test-corp') }
  let(:admin) { create(:admin_user) }
  let(:headers) { auth_headers(scheme: org.scheme, user: admin) }

  VACANCY_BASE_KEYS = %w[
    id role_title culture_dimensions competency_expectations
    created_by created_at updated_at
  ].freeze
  VACANCY_SKILL_SUMMARY_KEYS = %w[id skill_id skill_label expected_level].freeze
  VACANCY_SKILL_DETAIL_KEYS = VACANCY_SKILL_SUMMARY_KEYS +
    %w[l1_anchor l2_anchor l3_anchor l4_anchor l5_anchor]

  def vacancy_with_taxonomy
    vacancy = create(:vacancy, tenant_id: org.id, role_title: 'Backend Engineer')
    skill = create(:vacancy_skill, vacancy: vacancy, skill_label: 'SQL', expected_level: 4)
    create(:skill_taxonomy, skill_id: skill.skill_id)
    vacancy
  end

  describe 'GET /api/v1/vacancies' do
    it 'returns list rows whose skills are lightweight summaries without anchor keys' do
      vacancy_with_taxonomy

      get '/api/v1/vacancies', headers: headers

      expect(response).to have_http_status(:ok)
      row = JSON.parse(response.body)['vacancies'].first
      expect_json_keys(row, VACANCY_BASE_KEYS + ['skills'])
      expect_json_keys(row['skills'].first, VACANCY_SKILL_SUMMARY_KEYS)
    end
  end

  describe 'GET /api/v1/vacancies/:id' do
    it 'returns detail skills including the l1–l5 taxonomy anchors' do
      vacancy = vacancy_with_taxonomy

      get "/api/v1/vacancies/#{vacancy.id}", headers: headers

      expect(response).to have_http_status(:ok)
      detail = JSON.parse(response.body)['vacancy']
      expect_json_keys(detail, VACANCY_BASE_KEYS + ['skills'])
      expect_json_keys(detail['skills'].first, VACANCY_SKILL_DETAIL_KEYS)
      expect(detail['skills'].first['l1_anchor']).to eq('L1 anchor')
    end
  end
end
