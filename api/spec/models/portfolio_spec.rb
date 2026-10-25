# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Portfolio do
  around do |example|
    Current.using(tenant_id: 1) { example.run }
  end

  let(:assessment) { Assessment.create!(name: 'Backend Intern', time_limit_min: 30, created_by: 1) }
  let(:session)    { Session.create!(assessment: assessment, status: 'ended', end_reason: 'all_covered') }

  def portfolio_with(status:, changed_at:)
    portfolio = described_class.create!(session: session, generation_status: status)
    portfolio.update_column(:status_changed_at, changed_at)
    portfolio
  end

  describe 'status_changed_at' do
    it 'is stamped when the portfolio is created' do
      portfolio = described_class.create!(session: session)

      expect(portfolio.status_changed_at).to be_within(5.seconds).of(Time.current)
    end

    it 'is re-stamped when generation_status changes' do
      portfolio = portfolio_with(status: 'pending', changed_at: 1.hour.ago)

      portfolio.update!(generation_status: 'generating')

      expect(portfolio.status_changed_at).to be_within(5.seconds).of(Time.current)
    end

    it 'is not re-stamped when another attribute changes' do
      portfolio = portfolio_with(status: 'pending', changed_at: 1.hour.ago)

      portfolio.update!(generation_error: 'something')

      expect(portfolio.status_changed_at).to be < 59.minutes.ago
    end
  end

  describe '#stale?' do
    %w[pending generating].each do |status|
      it "is false for a #{status} portfolio that changed 1 minute ago" do
        expect(portfolio_with(status: status, changed_at: 1.minute.ago).stale?).to be(false)
      end

      it "is true for a #{status} portfolio that changed 11 minutes ago" do
        expect(portfolio_with(status: status, changed_at: 11.minutes.ago).stale?).to be(true)
      end
    end

    it 'is false for an old complete portfolio' do
      expect(portfolio_with(status: 'complete', changed_at: 2.days.ago).stale?).to be(false)
    end

    it 'is false for a failed portfolio' do
      expect(portfolio_with(status: 'failed', changed_at: 2.days.ago).stale?).to be(false)
    end

    it 'treats an unknown age as stale' do
      expect(portfolio_with(status: 'pending', changed_at: nil).stale?).to be(true)
    end
  end

  describe '#regenerable?' do
    it 'is true for a failed portfolio' do
      expect(portfolio_with(status: 'failed', changed_at: 1.minute.ago).regenerable?).to be(true)
    end

    it 'is true for a stale pending portfolio' do
      expect(portfolio_with(status: 'pending', changed_at: 11.minutes.ago).regenerable?).to be(true)
    end

    it 'is false for a fresh pending portfolio' do
      expect(portfolio_with(status: 'pending', changed_at: 1.minute.ago).regenerable?).to be(false)
    end

    it 'is false for a fresh generating portfolio' do
      expect(portfolio_with(status: 'generating', changed_at: 1.minute.ago).regenerable?).to be(false)
    end

    it 'is false for a complete portfolio' do
      expect(portfolio_with(status: 'complete', changed_at: 2.days.ago).regenerable?).to be(false)
    end
  end
end
