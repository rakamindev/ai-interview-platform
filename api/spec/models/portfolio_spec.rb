# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Portfolio do
  let(:org) { create_organization(scheme: 'acme') }

  around { |example| as_tenant(org) { example.run } }

  it 'can be destroyed once fit/gap reports exist for it' do
    portfolio = create(:portfolio)
    FitGapReport.create!(portfolio:, vacancy: create(:vacancy), skill_comparisons: [{ 'skill_label' => 'x' }])

    expect { portfolio.destroy! }.to change(FitGapReport, :count).by(-1)
  end
end
