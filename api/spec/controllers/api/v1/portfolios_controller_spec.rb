# frozen_string_literal: true

require "rails_helper"

RSpec.describe Api::V1::PortfoliosController, type: :controller do
  describe "#find_tenant_portfolio" do
    let(:portfolio_scope) { double("portfolio scope") }

    before do
      allow(controller).to receive(:current_tenant_id).and_return(17)
      allow(Portfolio).to receive(:joins).with(:session).and_return(portfolio_scope)
      allow(portfolio_scope).to receive(:where)
        .with(sessions: { tenant_id: 17 })
        .and_return(portfolio_scope)
    end

    it "looks up portfolios only through sessions owned by the current tenant" do
      portfolio = double("tenant portfolio")
      expect(portfolio_scope).to receive(:find).with("42").and_return(portfolio)

      expect(controller.send(:find_tenant_portfolio, "42")).to eq(portfolio)
    end

    it "keeps a foreign-tenant portfolio indistinguishable from a missing one" do
      expect(portfolio_scope).to receive(:find)
        .with("42")
        .and_raise(ActiveRecord::RecordNotFound)

      expect do
        controller.send(:find_tenant_portfolio, "42")
      end.to raise_error(ActiveRecord::RecordNotFound)
    end
  end

  describe "#set_portfolio" do
    it "uses the tenant-scoped lookup for direct portfolio routes such as export" do
      portfolio = double("tenant portfolio")
      allow(controller).to receive(:params)
        .and_return(ActionController::Parameters.new(id: "42"))
      expect(controller).to receive(:find_tenant_portfolio).with("42").and_return(portfolio)

      controller.send(:set_portfolio)

      expect(controller.instance_variable_get(:@portfolio)).to eq(portfolio)
    end
  end
end
