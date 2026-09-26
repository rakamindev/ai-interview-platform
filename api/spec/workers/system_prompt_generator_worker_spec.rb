# frozen_string_literal: true

require "rails_helper"

RSpec.describe SystemPromptGeneratorWorker do
  it "declares a retries-exhausted hook so a permanently failed job is not silent" do
    expect(described_class.sidekiq_retries_exhausted_block).to respond_to(:call)
  end

  it "logs the exhausted job without the raw error message" do
    allow(Rails.logger).to receive(:error)
    msg = { "args" => [42], "retry_count" => 3, "error_message" => "boom key=SECRET123" }

    described_class.sidekiq_retries_exhausted_block.call(msg, StandardError.new("boom"))

    expect(Rails.logger).to have_received(:error).with(satisfy { |m| m.include?("42") && !m.include?("SECRET123") })
  end
end
