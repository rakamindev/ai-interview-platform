# frozen_string_literal: true

require "rails_helper"

# P0 security fix — Rails' default request logging prints `Parameters: {...}` verbatim.
# Without config.filter_parameters covering sensitive keys, logins and PII-bearing
# endpoints leak plaintext passwords/tokens/PII into application logs.
RSpec.describe "filter_parameter_logging initializer" do
  let(:filter) { ActiveSupport::ParameterFilter.new(Rails.application.config.filter_parameters) }

  %i[password email secret_token access_token refresh_token resumption_token
     invite_token answer transcript ssn cvv].each do |key|
    it "filters params keyed #{key.inspect}" do
      filtered = filter.filter(key => "super-secret-value")

      expect(filtered[key]).to eq("[FILTERED]")
    end
  end

  it "filters nested password fields" do
    filtered = filter.filter(user: { email: "a@b.com", password: "sekret123" })

    expect(filtered[:user][:password]).to eq("[FILTERED]")
  end

  it "leaves unrelated params untouched" do
    filtered = filter.filter(role: "admin", turn_number: 3)

    expect(filtered[:role]).to eq("admin")
    expect(filtered[:turn_number]).to eq(3)
  end
end
