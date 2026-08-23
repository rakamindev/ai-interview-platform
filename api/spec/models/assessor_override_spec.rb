# frozen_string_literal: true

require 'rails_helper'

RSpec.describe AssessorOverride, type: :model do
  describe 'validations' do
    let(:portfolio_skill) { create(:portfolio_skill) }
    subject { build(:assessor_override, portfolio_skill: portfolio_skill) }

    it 'is valid with valid attributes' do
      expect(subject).to be_valid
    end

    it 'requires override_level to be between 1 and 5' do
      subject.override_level = 0
      expect(subject).not_to be_valid

      subject.override_level = 6
      expect(subject).not_to be_valid

      subject.override_level = 4
      expect(subject).to be_valid
    end
  end
end
