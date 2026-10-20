# frozen_string_literal: true

require 'rails_helper'

RSpec.describe AudioWebSocketMiddleware do
  let(:middleware) { described_class.new(->(_env) { [404, {}, []] }) }

  it 'removes JSON coverage echoes after natural language' do
    text = <<~TEXT
      That's a solid principle. How did you specifically implement that schema verification within your backend pipeline to ensure data consistency?
      ```json
      [ {"skill":"Node.js / Backend Development","state":"initiated","probe_count":1} ]
      ```
    TEXT

    sanitized = middleware.send(:sanitize_output_transcription, text)

    expect(sanitized).to include("That's a solid principle.")
    expect(sanitized).to include("data consistency?")
    expect(sanitized).not_to include('probe_count')
    expect(sanitized).not_to include('Node.js / Backend Development')
  end

  it 'leaves normal model prose unchanged' do
    text = 'Tell me about a backend tradeoff you made.'

    expect(middleware.send(:sanitize_output_transcription, text)).to eq(text)
  end
end
