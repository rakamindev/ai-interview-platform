# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Assessment, type: :model do
  let(:tenant) do
    Organization.find_by(identifier: 'rakamin-spec') ||
      Organization.create!(
        name: 'Rakamin Spec',
        scheme: 'rakamin_spec',
        identifier: 'rakamin-spec',
        host: 'spec.rakamin.com'
      )
  rescue ActiveRecord::RecordNotUnique
    Organization.first
  end

  let(:vacancy) do
    Vacancy.create!(
      tenant_id: tenant.id,
      created_by: 1,
      role_title: 'Backend Engineer'
    )
  end

  before do
    Current.organization = tenant
    Current.tenant_id = tenant.id
  end

  after do
    Current.clear
  end

  describe 'validations and associations' do
    it 'is valid with valid attributes' do
      assessment = Assessment.new(
        tenant_id: tenant.id,
        created_by: 1,
        name: 'Ruby on Rails Assessment',
        time_limit_min: 30,
        language: 'en'
      )
      expect(assessment).to be_valid
    end

    it 'is invalid without a name' do
      assessment = Assessment.new(
        tenant_id: tenant.id,
        created_by: 1,
        name: nil,
        time_limit_min: 30
      )
      expect(assessment).not_to be_valid
      expect(assessment.errors[:name]).to include("can't be blank")
    end

    it 'can optionally belong to a vacancy' do
      assessment = Assessment.create!(
        tenant_id: tenant.id,
        created_by: 1,
        vacancy: vacancy,
        name: 'Linked Assessment',
        time_limit_min: 45
      )
      expect(assessment.vacancy).to eq(vacancy)
      expect(vacancy.assessments).to include(assessment)
    end
  end

  describe 'assessment skills' do
    it 'creates associated assessment skills with expected levels' do
      assessment = Assessment.create!(
        tenant_id: tenant.id,
        created_by: 1,
        name: 'Technical Competency Evaluation',
        time_limit_min: 30
      )

      skill = assessment.assessment_skills.create!(
        skill_label: 'PostgreSQL Architecture',
        expected_level: 4,
        display_order: 1,
        l1_anchor: 'L1 basic understanding',
        l2_anchor: 'L2 guided execution',
        l3_anchor: 'L3 standard proficiency',
        l4_anchor: 'L4 advanced architecture',
        l5_anchor: 'L5 expert strategy'
      )

      expect(assessment.assessment_skills.count).to eq(1)
      expect(skill.expected_level).to eq(4)
      expect(skill.skill_label).to eq('PostgreSQL Architecture')
    end
  end
end
