require "rails_helper"

RSpec.describe Sessions::StartHandler do
  let(:session) { create(:session, status: "pending") }
  describe "#call" do
    it "publishes the status update via Sidekiq's pooled redis connection" do
      fake_conn = instance_double(Redis)
      allow(Sidekiq).to receive(:redis).and_yield(fake_conn)
      expect(fake_conn).to receive(:publish).with(
        "coverage:#{session.id}",
        a_string_matching(/"type":"session_status"/)
      )

      described_class.new(session).call
    end
  end
end
