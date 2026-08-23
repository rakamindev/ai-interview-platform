# frozen_string_literal: true

require "rails_helper"

RSpec.describe AudioWebSocketMiddleware::ConnectionRegistry do
  subject(:registry) { described_class.new }

  it "returns nil the first time a session connects" do
    expect(registry.take_over(1, :conn_a)).to be_nil
  end

  it "returns the previous connection when a session reconnects" do
    registry.take_over(1, :conn_a)
    expect(registry.take_over(1, :conn_b)).to eq(:conn_a)
  end

  it "tracks each session independently" do
    registry.take_over(1, :conn_a)
    expect(registry.take_over(2, :conn_b)).to be_nil
  end

  describe "#release" do
    it "forgets the connection when it matches the current one" do
      registry.take_over(1, :conn_a)
      registry.release(1, :conn_a)
      expect(registry.take_over(1, :conn_b)).to be_nil
    end

    it "ignores a stale close from a connection that was already superseded" do
      registry.take_over(1, :conn_a)
      registry.take_over(1, :conn_b)
      registry.release(1, :conn_a)
      expect(registry.take_over(1, :conn_c)).to eq(:conn_b)
    end
  end
end
