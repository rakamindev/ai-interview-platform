# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Portfolio, type: :model do
  describe 'validations' do
    it 'validates generation_status inclusion in GENERATION_STATUSES' do
      portfolio = Portfolio.new(generation_status: 'invalid_status')
      expect(portfolio).not_to be_valid
      expect(portfolio.errors[:generation_status]).to be_present

      Portfolio::GENERATION_STATUSES.each do |status|
        portfolio.generation_status = status
        portfolio.valid?
        expect(portfolio.errors[:generation_status]).to be_empty
      end
    end
  end

  describe 'status helper methods' do
    it 'returns true for active status helper queries' do
      expect(Portfolio.new(generation_status: 'complete').complete?).to be true
      expect(Portfolio.new(generation_status: 'generating').generating?).to be true
      expect(Portfolio.new(generation_status: 'failed').failed?).to be true
    end
  end

  describe 'associations' do
    it 'has_many portfolio_skills' do
      expect(Portfolio.reflect_on_association(:portfolio_skills).macro).to eq(:has_many)
    end

    it 'has_many assessor_overrides through portfolio_skills' do
      expect(Portfolio.reflect_on_association(:assessor_overrides).macro).to eq(:has_many)
    end
  end
end
