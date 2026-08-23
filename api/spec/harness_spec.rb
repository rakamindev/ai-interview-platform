# frozen_string_literal: true

require "rails_helper"

RSpec.describe "RSpec harness" do
  it "boots and has Rails loaded" do
    expect(Rails.application).to be_present
    expect(Rails.env).to eq("test")
  end

  it "has DatabaseCleaner configured" do
    expect(DatabaseCleaner).to be_present
  end

  it "has FactoryBot available" do
    expect(FactoryBot).to respond_to(:create)
  end
end
