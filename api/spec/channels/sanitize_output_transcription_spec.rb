# frozen_string_literal: true

require "rails_helper"

RSpec.describe AudioWebSocketMiddleware do
  subject(:middleware) { described_class.new(nil) }

  describe "#sanitize_output_transcription" do
    def sanitize(text)
      middleware.send(:sanitize_output_transcription, text)
    end

    it "strips caption/SRT-style timestamp markers" do
      text = "[ 0m29s609ms - 0m33s799ms ] Y es que la obesidad es un factor de riesgo."
      expect(sanitize(text)).to eq("Y es que la obesidad es un factor de riesgo.")
    end

    it "strips multiple caption timestamp markers across lines" do
      text = "[ 0m0s0ms - 0m5s0ms ] Hello there.\n[ 0m5s0ms - 0m10s0ms ] How are you?"
      expect(sanitize(text)).to eq("Hello there.\n How are you?")
    end

    it "leaves normal transcription text untouched" do
      text = "Can you tell me about your experience with Ruby on Rails?"
      expect(sanitize(text)).to eq(text)
    end

    it "still strips known metadata leaks alongside caption markers" do
      text = "[COVERAGE_MAP]{\"discovered\":[]}[/COVERAGE_MAP][ 0m1s0ms - 0m2s0ms ] Actual answer text."
      expect(sanitize(text)).to eq("Actual answer text.")
    end
  end
end
