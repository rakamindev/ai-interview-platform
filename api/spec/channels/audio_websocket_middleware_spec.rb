require_relative "../rails_helper"

RSpec.describe AudioWebSocketMiddleware do
  describe "#connect_to_gemini" do
    it "uses the session tenant while bootstrapping and restores the prior context" do
      middleware = described_class.allocate
      session = double("session", tenant_id: 42)
      state = double("connection state", session:)

      allow(middleware).to receive(:connect_to_gemini_for_session) do
        expect(Current.tenant_id).to eq(42)
        :connected
      end
      Current.clear

      result = middleware.send(:connect_to_gemini, nil, state)

      expect(result).to eq(:connected)
      expect(RequestStore.store).not_to have_key(:tenant_id)
    end
  end
end