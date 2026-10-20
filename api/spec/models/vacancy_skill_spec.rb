# frozen_string_literal: true

require 'rails_helper'

RSpec.describe VacancySkill, type: :model do
  let(:org) { Organization.create!(name: 'Vacancy Org', scheme: 'vacorg', identifier: 'vacorg', host: 'vacorg.test') }
  let(:vacancy) do
    Vacancy.create!(
      tenant_id: org.id,
      created_by: 1,
      role_title: 'Senior Site Reliability Engineer'
    )
  end

  describe 'custom competency persistence and schema constraints' do
    it 'persists custom vacancy skills without skill_id when is_custom is true' do
      custom_skill = VacancySkill.new(
        vacancy: vacancy,
        skill_id: nil,
        skill_label: 'Indonesian Fintech Payment Gateway Integration',
        expected_level: 4,
        is_custom: true
      )

      expect(custom_skill).to be_valid
      expect(custom_skill.custom?).to be true
      expect { custom_skill.save! }.not_to raise_error

      reloaded = custom_skill.reload
      expect(reloaded.skill_id).to be_nil
      expect(reloaded.is_custom).to be true
      expect(reloaded.expected_level).to eq(4)
    end

    it 'persists standard taxonomy skills with skill_id' do
      standard_skill = VacancySkill.new(
        vacancy: vacancy,
        skill_id: 'SK-ENG-001',
        skill_label: 'React / Frontend Development Core',
        expected_level: 3,
        is_custom: false
      )

      expect(standard_skill).to be_valid
      expect(standard_skill.custom?).to be false
      expect { standard_skill.save! }.not_to raise_error
    end

    it 'automatically marks skill as custom when skill_id is blank' do
      skill = VacancySkill.new(
        vacancy: vacancy,
        skill_id: nil,
        skill_label: 'Custom Cloud Architecture',
        expected_level: 3
      )

      expect(skill).to be_valid
      skill.save!
      expect(skill.reload.is_custom).to be true
      expect(skill.custom?).to be true
    end

    it 'enforces database check constraint chk_vacancy_skills_custom_or_id' do
      expect do
        ActiveRecord::Base.connection.execute(
          "INSERT INTO vacancy_skills (vacancy_id, skill_id, skill_label, expected_level, is_custom) " \
          "VALUES (#{vacancy.id}, NULL, 'Direct DB Injection', 3, false)"
        )
      end.to raise_error(ActiveRecord::StatementInvalid, /chk_vacancy_skills_custom_or_id/)
    end

    it 'filters via .custom and .standard scopes' do
      custom = vacancy.vacancy_skills.create!(
        skill_id: nil,
        skill_label: 'Proprietary Core Banking Protocol',
        expected_level: 5,
        is_custom: true
      )
      standard = vacancy.vacancy_skills.create!(
        skill_id: 'SK-ENG-002',
        skill_label: 'Node.js / Backend Development',
        expected_level: 3,
        is_custom: false
      )

      expect(vacancy.vacancy_skills.custom).to include(custom)
      expect(vacancy.vacancy_skills.custom).not_to include(standard)
      expect(vacancy.vacancy_skills.standard).to include(standard)
      expect(vacancy.vacancy_skills.standard).not_to include(custom)
    end
  end
end
