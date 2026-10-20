# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Cv::ParserService do
  describe '.call' do
    it 'normalizes Windows CRLF and trailing whitespaces' do
      raw_cv = "John Doe\r\nSoftware Engineer\r\n\r\nExperience:\r\n- Built Go services\r\n"
      parsed = described_class.call(raw_cv)

      expect(parsed).not_to include("\r")
      expect(parsed).to include("Experience:\n- Built Go services")
      expect(parsed).to start_with('John Doe')
    end

    it 'scrubs invalid byte sequences gracefully' do
      invalid_utf8 = "Senior Engineer \xFF\xFE at FinTech Corp".b
      parsed = described_class.call(invalid_utf8)

      expect(parsed).to be_a(String)
      expect(parsed.encoding).to eq(Encoding::UTF_8)
      expect(parsed).to include('Senior Engineer at FinTech Corp')
    end

    it 'collapses excessive newlines down to double newlines' do
      sparse_text = "Headline\n\n\n\n\nNext Section"
      parsed = described_class.call(sparse_text)

      expect(parsed).to eq("Headline\n\nNext Section")
    end

    it 'handles IO/StringIO streams' do
      io = StringIO.new("Candidate Resume from stream\nSkills: Ruby, PostgreSQL")
      parsed = described_class.call(io)

      expect(parsed).to include('Candidate Resume from stream')
      expect(parsed).to include('Skills: Ruby, PostgreSQL')
    end

    it 'extracts readable text fragments when passed raw PDF bytecode' do
      raw_pdf = "%PDF-1.7\n1 0 obj\n<</Type/Catalog>>\nendobj\n(Budi Santoso) Tj\n(Senior Software Engineer) Tj"
      parsed = described_class.call(raw_pdf)

      expect(parsed).not_to start_with('%PDF-1.7')
      expect(parsed).to include('Budi Santoso')
      expect(parsed).to include('Senior Software Engineer')
    end
  end
end
