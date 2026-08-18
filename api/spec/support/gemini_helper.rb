# frozen_string_literal: true

module GeminiHelper
  def gemini_stub(mode: :valid)
    Gemini::StubClient.new(mode: mode)
  end

  def gemini_stub_for(service_class)
    service_class.new(gemini_client: gemini_stub)
  end
end
