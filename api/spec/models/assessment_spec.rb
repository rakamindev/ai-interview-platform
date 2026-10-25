require 'rails_helper'

RSpec.describe Assessment, type: :model do
  let(:valid_attributes) do
    {
      name: 'Backend Dev Assessment',
      time_limit_min: 45,
      language: 'en',
      tenant_id: 1,
      created_by: 1
    }
  end

  before { Current.tenant_id = 1 }

  describe 'Validations' do
    context 'Positive Cases' do
      it 'is valid with valid attributes' do
        assessment = Assessment.new(valid_attributes)
        expect(assessment).to be_valid
      end
    end

    context 'Negative Cases' do
      it 'is invalid without a name' do
        assessment = Assessment.new(valid_attributes.merge(name: nil))
        expect(assessment).not_to be_valid
        expect(assessment.errors[:name]).to include("can't be blank")
      end

      it 'is invalid with an incorrect time_limit_min' do
        assessment = Assessment.new(valid_attributes.merge(time_limit_min: 15))
        expect(assessment).not_to be_valid
        expect(assessment.errors[:time_limit_min]).to include('is not included in the list')
      end

      it 'is invalid without time_limit_min' do
        assessment = Assessment.new(valid_attributes.merge(time_limit_min: nil))
        expect(assessment).not_to be_valid
      end

      it 'is invalid with unsupported language' do
        assessment = Assessment.new(valid_attributes.merge(language: 'fr'))
        expect(assessment).not_to be_valid
        expect(assessment.errors[:language]).to include('is not included in the list')
      end
    end
  end

  describe 'Associations' do
    it 'creates assessment skills successfully' do
      assessment = Assessment.create!(valid_attributes)
      assessment.assessment_skills.create!(
        skill_label: 'Ruby', 
        expected_level: 4,
        l1_anchor: 'Level 1',
        l2_anchor: 'Level 2',
        l3_anchor: 'Level 3',
        l4_anchor: 'Level 4',
        l5_anchor: 'Level 5'
      )
      expect(assessment.assessment_skills.count).to eq(1)
    end
  end
end
