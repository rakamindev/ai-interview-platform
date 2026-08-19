# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Portfolio, type: :model do
  describe 'validations' do
    it { should validate_inclusion_of(:generation_status).in_array(Portfolio::GENERATION_STATUSES) }
  end

  describe 'associations' do
    it { should belong_to(:session) }
    it { should have_many(:portfolio_skills).dependent(:destroy) }
  end

  describe 'scopes' do
    let!(:complete_portfolio) { create(:portfolio, generation_status: 'complete') }
    let!(:failed_portfolio) { create(:portfolio, :failed) }
    let!(:generating_portfolio) { create(:portfolio, :generating) }

    it '.complete returns complete portfolios' do
      expect(Portfolio.complete).to include(complete_portfolio)
    end

    it '.failed returns failed portfolios' do
      expect(Portfolio.failed).to include(failed_portfolio)
    end

    it '.generating returns generating portfolios' do
      expect(Portfolio.generating).to include(generating_portfolio)
    end
  end

  describe 'status methods' do
    it '#complete? returns true when status is complete' do
      expect(build(:portfolio, generation_status: 'complete').complete?).to be true
    end

    it '#generating? returns true when status is generating' do
      expect(build(:portfolio, :generating).generating?).to be true
    end

    it '#failed? returns true when status is failed' do
      expect(build(:portfolio, :failed).failed?).to be true
    end
  end

  describe 'factory' do
    it 'has a valid factory' do
      expect(build(:portfolio)).to be_valid
    end
  end
end
