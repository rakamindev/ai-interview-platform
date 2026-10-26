# frozen_string_literal: true

require 'rails_helper'

# The edit pages must send removed skills as _destroy: Rails nested attributes keep any skill the payload leaves out.
RSpec.describe 'Removing a skill on the edit pages' do
  let(:org)     { Organization.create!(name: 'Test Corp', scheme: 'test-corp', identifier: 'test-corp', host: 'test-corp.local') }
  let(:headers) { { 'Authorization' => "Bearer #{JsonWebToken.encode({ user_id: 1, role: 'admin', scheme: org.scheme })}" } }

  def anchors
    { l1_anchor: 'L1', l2_anchor: 'L2', l3_anchor: 'L3', l4_anchor: 'L4', l5_anchor: 'L5' }
  end

  describe 'PUT /api/v1/assessments/:id' do
    let(:assessment) do
      Assessment.create!(tenant_id: org.id, created_by: 1, name: 'Backend Engineer', time_limit_min: 30,
                         assessment_skills_attributes: [{ skill_label: 'Ruby', display_order: 0, **anchors },
                                                        { skill_label: 'SQL', display_order: 1, **anchors }])
    end
    let(:ruby) { assessment.assessment_skills.find_by!(skill_label: 'Ruby') }
    let(:sql)  { assessment.assessment_skills.find_by!(skill_label: 'SQL') }

    def update_skills(attrs)
      put "/api/v1/assessments/#{assessment.id}", headers:, params: { assessment: { assessment_skills_attributes: attrs } }
    end

    it 'keeps a skill that is only left out of the payload (the old edit page behaviour)' do
      update_skills([{ id: ruby.id, skill_label: 'Ruby' }])

      expect(response).to have_http_status(:ok)
      expect(assessment.assessment_skills.reload.pluck(:skill_label)).to contain_exactly('Ruby', 'SQL')
    end

    it 'deletes a skill sent with _destroy (what the edit page now sends)' do
      update_skills([{ id: ruby.id, skill_label: 'Ruby' }, { id: sql.id, _destroy: true }])

      expect(response).to have_http_status(:ok)
      expect(assessment.assessment_skills.reload.pluck(:skill_label)).to eq(['Ruby'])
      expect(response.parsed_body.dig('assessment', 'skills').map { _1['skill_label'] }).to eq(['Ruby'])
    end
  end

  describe 'PUT /api/v1/vacancies/:id' do
    let(:vacancy) do
      Vacancy.create!(tenant_id: org.id, created_by: 1, role_title: 'Backend Engineer',
                      vacancy_skills_attributes: [{ skill_label: 'Ruby', expected_level: 3 },
                                                  { skill_label: 'SQL', expected_level: 3 }])
    end
    let(:ruby) { vacancy.vacancy_skills.find_by!(skill_label: 'Ruby') }
    let(:sql)  { vacancy.vacancy_skills.find_by!(skill_label: 'SQL') }

    def update_skills(attrs)
      put "/api/v1/vacancies/#{vacancy.id}", headers:, params: { vacancy: { vacancy_skills_attributes: attrs } }
    end

    it 'keeps a skill that is only left out of the payload (the old edit page behaviour)' do
      update_skills([{ id: ruby.id, skill_label: 'Ruby', expected_level: 3 }])

      expect(vacancy.vacancy_skills.reload.pluck(:skill_label)).to contain_exactly('Ruby', 'SQL')
    end

    it 'deletes a skill sent with _destroy (what the edit page now sends)' do
      update_skills([{ id: ruby.id, skill_label: 'Ruby', expected_level: 3 }, { id: sql.id, _destroy: true }])

      expect(response).to have_http_status(:ok)
      expect(vacancy.vacancy_skills.reload.pluck(:skill_label)).to eq(['Ruby'])
    end
  end
end
