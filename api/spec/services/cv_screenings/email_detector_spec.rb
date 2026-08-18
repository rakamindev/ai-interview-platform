# frozen_string_literal: true

require 'rails_helper'

RSpec.describe CvScreenings::EmailDetector do
  it 'finds a single email in the header block' do
    text = "Jordan Example\njordan.example@test.invalid\nSummary...\n" + ("filler line\n" * 20)

    result = described_class.new(text).call

    expect(result.email).to eq('jordan.example@test.invalid')
    expect(result.multiple_found).to be(false)
  end

  it 'prefers the header email over a referee email further down the document' do
    text = "Jordan Example\njordan.example@test.invalid\n" + ("filler\n" * 20) +
           "References:\nreferee@test.invalid"

    result = described_class.new(text).call

    expect(result.email).to eq('jordan.example@test.invalid')
  end

  it 'is ambiguous when the header block itself has multiple distinct emails' do
    text = "Jordan Example\njordan.example@test.invalid\nbackup@test.invalid\n"

    result = described_class.new(text).call

    expect(result.email).to be_nil
    expect(result.multiple_found).to be(true)
  end

  it 'falls back to scanning the whole document when the header has no email' do
    text = ("filler line\n" * 10) + "Contact: jordan.example@test.invalid"

    result = described_class.new(text).call

    expect(result.email).to eq('jordan.example@test.invalid')
  end

  it 'is ambiguous when multiple distinct emails exist outside the header' do
    text = ("filler line\n" * 10) + "jordan.example@test.invalid\nreferee@test.invalid"

    result = described_class.new(text).call

    expect(result.email).to be_nil
    expect(result.multiple_found).to be(true)
  end

  it 'returns nil, not a guess, when no email is found anywhere' do
    result = described_class.new('No contact information here at all.').call

    expect(result.email).to be_nil
    expect(result.multiple_found).to be(false)
  end
end
