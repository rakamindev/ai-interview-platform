# frozen_string_literal: true

require "rails_helper"

RSpec.describe Vacancy, type: :model do
  let(:tenant_id) { 1 }

  before do
    Current.tenant_id = tenant_id
  end

  it "destroys its skill configurations when deleted" do
    vacancy = described_class.create!(
      tenant_id: tenant_id,
      created_by: 1,
      role_title: "Backend Engineer"
    )
    skill = vacancy.vacancy_skills.create!(
      skill_id: "ruby",
      skill_label: "Ruby",
      expected_level: 3
    )

    expect { vacancy.destroy! }.to change(VacancySkill, :count).by(-1)
    expect { skill.reload }.to raise_error(ActiveRecord::RecordNotFound)
  end
end
