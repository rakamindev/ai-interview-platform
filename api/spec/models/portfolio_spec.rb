# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Portfolio, type: :model do
  describe 'tenant attribution' do
    it 'inherits tenant_id from its session when created outside a request (Sidekiq path)' do
      session = create(:session, tenant_id: 4242)

      portfolio = create(:portfolio, session: session)

      expect(portfolio.tenant_id).to eq(4242)
    end

    it 'stamps the request tenant when one is present' do
      session = create(:session, tenant_id: 1)

      Current.using(tenant_id: 99) do
        portfolio = create(:portfolio, session: session)

        expect(portfolio.tenant_id).to eq(99)
      end
    end

    it 'never leaves tenant_id nil' do
      session = create(:session, tenant_id: 4242)
      portfolio = build(:portfolio, session: session)

      expect { portfolio.save! }.not_to raise_error
      expect(portfolio.tenant_id).to eq(4242)
    end
  end
end
