# frozen_string_literal: true

require 'rails_helper'

RSpec.describe VacancySkill, type: :model do
  describe 'associations' do
    it { is_expected.to belong_to(:vacancy) }
  end

  describe 'validations' do
    it { is_expected.to validate_presence_of(:skill_label) }
    it { is_expected.to validate_numericality_of(:expected_level).only_integer.is_in(1..5) }
  end
end