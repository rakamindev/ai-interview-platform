
# frozen_string_literal: true

require "rails_helper"

RSpec.describe Api::V1::PortfoliosController, type: :controller do
  describe "POST #regenerate_fitgap" do
    let(:portfolio) { instance_double(Portfolio, id: 101, complete?: true) }
    let(:vacancy) { instance_double(Vacancy, id: 202) }

    before do
      allow(controller).to receive(:require_tenant!)
      allow(controller).to receive(:authenticate_with_roles!)

      allow(Portfolio).to receive(:find)
        .with("101")
        .and_return(portfolio)

      allow(Vacancy).to receive(:find_by)
        .with(id: "202")
        .and_return(vacancy)
    end

    it "queues regeneration and returns accepted" do
      expect(FitGapGeneratorWorker).to receive(:perform_async)
        .with(101, 202)

      post :regenerate_fitgap,
           params: { id: "101", vacancy_id: "202" }

      expect(response).to have_http_status(:accepted)
      expect(JSON.parse(response.body)).to include(
        "status" => "generating"
      )
    end

    it "returns unprocessable entity when vacancy_id is missing" do
      expect(FitGapGeneratorWorker).not_to receive(:perform_async)

      post :regenerate_fitgap, params: { id: "101" }

      expect(response).to have_http_status(:unprocessable_entity)
    end

    it "does not queue regeneration when the portfolio is incomplete" do
      allow(portfolio).to receive(:complete?).and_return(false)
      expect(FitGapGeneratorWorker).not_to receive(:perform_async)

      post :regenerate_fitgap,
           params: { id: "101", vacancy_id: "202" }

      expect(response).to have_http_status(:unprocessable_entity)
    end
  end
end
