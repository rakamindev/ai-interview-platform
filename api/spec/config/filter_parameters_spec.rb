# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Parameter log filtering" do
  let(:filter) { ActiveSupport::ParameterFilter.new(Rails.application.config.filter_parameters) }

  it "redacts credentials and tokens so they never reach the Rails log" do
    filtered = filter.filter(
      "password" => "hunter2", "token" => "jwt.abc.def", "authorization" => "Bearer x",
      "api_key" => "k", "email" => "a@b.co"
    )

    expect(filtered.values_at("password", "token", "authorization", "api_key")).to all(eq("[FILTERED]"))
  end

  it "redacts candidate personal data and transcript text (UU PDP)" do
    filtered = filter.filter("candidate_name" => "Budi", "text" => "spoken words", "email" => "a@b.co")

    expect(filtered.values).to all(eq("[FILTERED]"))
  end

  it "does not over-redact unrelated keys that merely contain 'text'" do
    filtered = filter.filter("context" => "keep", "textarea" => "keep")

    expect(filtered.values).to all(eq("keep"))
  end
end
