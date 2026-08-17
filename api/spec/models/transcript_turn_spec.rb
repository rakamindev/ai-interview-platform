# frozen_string_literal: true

require "rails_helper"

RSpec.describe TranscriptTurn, type: :model do
  let(:org) { create_test_organization }
  let(:assessment) { Current.using(tenant_id: org.id) { create(:assessment) } }
  let(:session_record) { Current.using(tenant_id: org.id) { create(:session, assessment: assessment) } }

  describe "text encryption at rest" do
    it "stores ciphertext in the raw database column" do
      turn = Current.using(tenant_id: org.id) do
        create(:transcript_turn, session: session_record, text: "My name is Budi Santoso")
      end

      raw_value = ActiveRecord::Base.connection.select_value(
        "SELECT text FROM transcript_turns WHERE id = #{turn.id}"
      )

      expect(raw_value).not_to include("Budi Santoso")
    end

    it "returns the original plaintext through the model" do
      turn = Current.using(tenant_id: org.id) do
        create(:transcript_turn, session: session_record, text: "My name is Budi Santoso")
      end

      expect(turn.reload.text).to eq("My name is Budi Santoso")
    end
  end
end
