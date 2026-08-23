# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Portfolio, type: :model do
  describe 'associations' do
    it { is_expected.to belong_to(:session) }
    it { is_expected.to have_many(:portfolio_skills).dependent(:destroy) }
    it { is_expected.to have_many(:assessor_overrides).through(:portfolio_skills) }
  end

  describe 'validations' do
    it { is_expected.to validate_inclusion_of(:generation_status).in_array(%w[pending generating complete failed]) }
  end

  describe 'scopes' do
    let!(:pending_portfolio) { create(:portfolio, generation_status: 'pending') }
    let!(:complete_portfolio) { create(:portfolio, :complete) }
    let!(:generating_portfolio) { create(:portfolio, :generating) }
    let!(:failed_portfolio) { create(:portfolio, :failed) }

    describe '.complete' do
      it 'returns complete portfolios' do
        expect(Portfolio.complete).to include(complete_portfolio)
        expect(Portfolio.complete).not_to include(pending_portfolio, generating_portfolio, failed_portfolio)
      end
    end

    describe '.generating' do
      it 'returns generating portfolios' do
        expect(Portfolio.generating).to include(generating_portfolio)
        expect(Portfolio.generating).not_to include(pending_portfolio, complete_portfolio, failed_portfolio)
      end
    end

    describe '.failed' do
      it 'returns failed portfolios' do
        expect(Portfolio.failed).to include(failed_portfolio)
        expect(Portfolio.failed).not_to include(pending_portfolio, complete_portfolio, generating_portfolio)
      end
    end
  end

  describe 'instance methods' do
    describe '#complete?' do
      it 'returns true when generation_status is complete' do
        portfolio = build(:portfolio, generation_status: 'complete')
        expect(portfolio.complete?).to be true
      end

      it 'returns false when generation_status is not complete' do
        portfolio = build(:portfolio, generation_status: 'pending')
        expect(portfolio.complete?).to be false
      end
    end

    describe '#generating?' do
      it 'returns true when generation_status is generating' do
        portfolio = build(:portfolio, generation_status: 'generating')
        expect(portfolio.generating?).to be true
      end

      it 'returns false when generation_status is not generating' do
        portfolio = build(:portfolio, generation_status: 'pending')
        expect(portfolio.generating?).to be false
      end
    end

    describe '#failed?' do
      it 'returns true when generation_status is failed' do
        portfolio = build(:portfolio, generation_status: 'failed')
        expect(portfolio.failed?).to be true
      end

      it 'returns false when generation_status is not failed' do
        portfolio = build(:portfolio, generation_status: 'pending')
        expect(portfolio.failed?).to be false
      end
    end
  end
end
