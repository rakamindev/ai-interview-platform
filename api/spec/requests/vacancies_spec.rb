# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Vacancy requirements API', :aggregate_failures do
  let!(:organization) do
    Organization.create!(
      name: 'Test Corp',
      scheme: 'test-corp',
      identifier: 'test-corp',
      host: 'test.example.com'
    )
  end
  let(:headers) do
    token = JsonWebToken.encode(user_id: 7, role: 'admin', scheme: organization.scheme)
    { 'Authorization' => "Bearer #{token}" }
  end
  let(:valid_attributes) do
    {
      role_title: 'Frontend Engineer',
      culture_dimensions: 'Async-first',
      competency_expectations: 'Leads projects',
      vacancy_skills_attributes: [{ skill_label: 'React', expected_level: 3 }]
    }
  end
  let(:normalized_text) do
    {
      'role_title' => 'Frontend Engineer',
      'culture_dimensions' => 'Async-first',
      'competency_expectations' => 'Leads projects'
    }
  end
  let!(:vacancy) do
    Vacancy.create!(valid_attributes.merge(tenant_id: organization.id, created_by: 7))
  end

  def submit_vacancy(attributes)
    post '/api/v1/vacancies', params: { vacancy: attributes }, headers: headers
  end

  def error_message
    response.parsed_body.dig('errors', 0, 'message')
  end

  def remove_only_skill
    put "/api/v1/vacancies/#{vacancy.id}",
        params: { vacancy: { vacancy_skills_attributes: [{ id: vacancy.vacancy_skills.first.id, _destroy: true }] } },
        headers: headers
  end

  it 'rejects a vacancy without culture dimensions' do
    expect do
      submit_vacancy(valid_attributes.merge(culture_dimensions: '   '))
    end.not_to change(Vacancy, :count)
    expect(response).to have_http_status(:unprocessable_entity)
    expect(error_message).to eq("Culture dimensions can't be blank")
  end

  it 'rejects a vacancy without competency expectations' do
    expect do
      submit_vacancy(valid_attributes.merge(competency_expectations: '   '))
    end.not_to change(Vacancy, :count)
    expect(response).to have_http_status(:unprocessable_entity)
    expect(error_message).to eq("Competency expectations can't be blank")
  end

  it 'rejects a vacancy without an expected skill' do
    expect do
      submit_vacancy(valid_attributes.merge(vacancy_skills_attributes: []))
    end.not_to change(Vacancy, :count)
    expect(response).to have_http_status(:unprocessable_entity)
    expect(error_message).to eq('Vacancy skills must include at least one skill')
  end

  it 'rejects removing the final expected skill' do
    expect { remove_only_skill }.not_to change(VacancySkill, :count)
    expect(response).to have_http_status(:unprocessable_entity)
    expect(error_message).to eq('Vacancy skills must include at least one skill')
  end

  it 'trims required text before creating a complete vacancy' do
    expect do
      submit_vacancy(valid_attributes.transform_values { |value| value.is_a?(String) ? "  #{value}  " : value })
    end.to change(Vacancy, :count).by(1)
    expect(response).to have_http_status(:created)
    expect(response.parsed_body.fetch('vacancy').slice(*normalized_text.keys)).to eq(normalized_text)
  end
end
