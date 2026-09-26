# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Portfolio do
  describe '#claim!' do
    %w[pending failed].each do |status|
      it "takes a #{status} report and marks it generating" do
        portfolio = create(:portfolio, generation_status: status)

        expect(portfolio.claim!).to be(true)
        expect(portfolio.generation_status).to eq('generating')
      end
    end

    it 'refuses a report another job is working on' do
      portfolio = create(:portfolio, generation_status: 'generating')

      expect(portfolio.claim!).to be(false)
    end

    it 'takes over a report whose job stopped more than 5 minutes ago' do
      portfolio = create(:portfolio, generation_status: 'generating')
      portfolio.update_column(:status_changed_at, 6.minutes.ago)

      expect(portfolio.claim!).to be(true)
      expect(portfolio.status_changed_at).to be_within(5.seconds).of(Time.current)
    end

    it 'refuses a report that is already complete' do
      expect(create(:portfolio, generation_status: 'complete').claim!).to be(false)
    end

    it 'lets only the first of two jobs holding the same report take it' do
      first = create(:portfolio, generation_status: 'pending')
      second = described_class.find(first.id)

      expect([first.claim!, second.claim!]).to eq([true, false])
    end
  end

  describe 'status_changed_at' do
    it 'is set on a new report straight away, not only in the database' do
      expect(create(:portfolio, generation_status: 'pending').status_changed_at)
        .to be_within(5.seconds).of(Time.current)
    end

    it 'moves when the status changes' do
      portfolio = create(:portfolio, generation_status: 'generating')
      portfolio.update_column(:status_changed_at, 1.hour.ago)

      portfolio.update!(generation_status: 'pending')

      expect(portfolio.status_changed_at).to be_within(5.seconds).of(Time.current)
    end

    it 'stays put when only other fields change' do
      portfolio = create(:portfolio, generation_status: 'failed')
      portfolio.update_column(:status_changed_at, 1.hour.ago)

      portfolio.update!(generation_error: 'details for operators')

      expect(portfolio.status_changed_at).to be < 59.minutes.ago
    end
  end

  describe 'failure kind' do
    it 'must be one of the known kinds' do
      expect(build(:portfolio, failure_kind: 'model_unavailable')).to be_valid
      expect(build(:portfolio, failure_kind: 'bad_luck')).not_to be_valid
    end

    it 'is also checked by the database' do
      portfolio = build(:portfolio, failure_kind: 'bad_luck')

      expect { portfolio.save!(validate: false) }
        .to raise_error(ActiveRecord::StatementInvalid, /chk_portfolios_failure_kind/)
    end
  end
end
