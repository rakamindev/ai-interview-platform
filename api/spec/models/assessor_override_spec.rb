# frozen_string_literal: true

require 'rails_helper'

RSpec.describe AssessorOverride, type: :model do
  describe 'associations' do
    it { is_expected.to belong_to(:portfolio_skill) }
  end

  describe 'validations' do
    it { is_expected.to validate_numericality_of(:ai_level).only_integer.is_in(1..5) }
    it { is_expected.to validate_numericality_of(:override_level).only_integer.is_in(1..5) }
    it { is_expected.to validate_presence_of(:overridden_by) }
  end
end