# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Assessment, type: :model do
  before do
    Current.tenant_id = 1
  end

  after do
    Current.tenant_id = nil
  end

  describe 'validations' do
    it 'is valid with valid attributes' do
      assessment = Assessment.new(
        name: 'Senior Fullstack Engineer',
        time_limit_min: 45,
        language: 'en'
      )
      expect(assessment).to be_valid
    end

    it 'is invalid without a name' do
      assessment = Assessment.new(name: nil, time_limit_min: 45)
      expect(assessment).not_to be_valid
      expect(assessment.errors[:name]).to include("can't be blank")
    end

    it 'is invalid with an unsupported time limit' do
      assessment = Assessment.new(name: 'Backend Dev', time_limit_min: 25)
      expect(assessment).not_to be_valid
      expect(assessment.errors[:time_limit_min]).to include('is not included in the list')
    end

    it 'accepts all supported time limits [10, 30, 45, 60, 90]' do
      [10, 30, 45, 60, 90].each do |duration|
        assessment = Assessment.new(name: 'Dev', time_limit_min: duration, language: 'en')
        expect(assessment).to be_valid
      end
    end

    it 'is invalid with an unsupported language' do
      assessment = Assessment.new(name: 'Dev', time_limit_min: 30, language: 'fr')
      expect(assessment).not_to be_valid
      expect(assessment.errors[:language]).to include('is not included in the list')
    end

    it 'allows supported languages en and id' do
      %w[en id].each do |lang|
        assessment = Assessment.new(name: 'Dev', time_limit_min: 30, language: lang)
        expect(assessment).to be_valid
      end
    end

    it 'enforces tenant_id requirement via TenantScoped' do
      Current.tenant_id = nil
      assessment = Assessment.new(name: 'Dev', time_limit_min: 30)
      expect(assessment).not_to be_valid
      expect(assessment.errors[:tenant_id]).to include("can't be blank")
    end
  end
end
