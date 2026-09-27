# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Assessment, type: :model do
  before do
    @organization = Organization.create!(
      name: 'Test Org', scheme: 'test-org', identifier: 'test-org', host: 'test-org.test'
    )
  end

  describe 'validation' do
    it 'returns error when name is not given' do
      within_organization do
        subject = described_class.new(name: '', time_limit_min: 30, created_by: 1)
        expect(subject.save).to eq(false)
      end
    end

    it 'returns error when time limit is not one of the allowed options' do
      within_organization do
        subject = described_class.new(name: 'Jr. Backend Engineer', time_limit_min: 20, created_by: 1)
        expect(subject.save).to eq(false)
      end
    end

    it 'raises when created outside an organization' do
      subject = described_class.new(name: 'Jr. Backend Engineer', time_limit_min: 30, created_by: 1)
      expect { subject.save }.to raise_error(RuntimeError, /please set Current.tenant_id/)
    end

    it 'returns error when two skills have the same label ignoring case and spaces' do
      within_organization do
        subject = described_class.new(
          name: 'Jr. Backend Engineer', time_limit_min: 30, created_by: 1,
          assessment_skills_attributes: [
            skill_attributes(skill_label: 'RESTful API Design', display_order: 0),
            skill_attributes(skill_label: ' restful  api design ', display_order: 1)
          ]
        )
        expect(subject.save).to eq(false)
        expect(subject.errors.full_messages.join).to include('RESTful API Design')
        expect(described_class.count).to eq(0)
      end
    end

    it 'returns error when a taxonomy skill and a custom skill have the same label' do
      within_organization do
        subject = described_class.new(
          name: 'Jr. Backend Engineer', time_limit_min: 30, created_by: 1,
          assessment_skills_attributes: [
            skill_attributes(skill_label: 'RESTful API Design', is_custom: false),
            skill_attributes(skill_label: 'RESTful API Design', is_custom: true, display_order: 1)
          ]
        )
        expect(subject.save).to eq(false)
      end
    end
  end

  describe 'Create' do
    it 'returns ok with valid inputs' do
      within_organization do
        subject = described_class.new(name: 'Jr. Backend Engineer', time_limit_min: 30, created_by: 1)
        expect(subject.save).to eq(true)
        expect(subject.tenant_id).to eq(@organization.id)
      end
    end
  end

  describe 'Update' do
    before do
      within_organization do
        @assessment = described_class.new(
          name: 'Jr. Backend Engineer', time_limit_min: 30, created_by: 1,
          assessment_skills_attributes: [skill_attributes(skill_label: 'RESTful API Design')]
        )
        @assessment.save!
      end
    end

    it 'returns error when adding a skill with the same label as a saved one' do
      within_organization do
        result = @assessment.update(
          time_limit_min: 45,
          assessment_skills_attributes: [skill_attributes(skill_label: 'restful api design', display_order: 1)]
        )
        expect(result).to eq(false)
        expect(@assessment.reload.time_limit_min).to eq(30)
        expect(@assessment.assessment_skills.size).to eq(1)
      end
    end

    it 'returns ok when removing one copy of an existing duplicate' do
      within_organization do
        copy = @assessment.assessment_skills.create!(
          skill_attributes(skill_label: 'RESTful API Design', display_order: 1)
        )
        result = @assessment.update(assessment_skills_attributes: [{ id: copy.id, _destroy: true }])
        expect(result).to eq(true)
        expect(@assessment.reload.assessment_skills.size).to eq(1)
      end
    end
  end

  describe 'tenant scoping' do
    it 'returns only assessments of the current organization' do
      other_organization = Organization.create!(
        name: 'Other Org', scheme: 'other-org', identifier: 'other-org', host: 'other-org.test'
      )
      within_organization(other_organization) do
        described_class.new(name: 'Other Assessment', time_limit_min: 30, created_by: 1).save!
      end

      within_organization do
        mine = described_class.new(name: 'Jr. Backend Engineer', time_limit_min: 30, created_by: 1)
        mine.save!
        expect(described_class.all.size).to eq(1)
        expect(described_class.first).to eq(mine)
      end
    end
  end
end
