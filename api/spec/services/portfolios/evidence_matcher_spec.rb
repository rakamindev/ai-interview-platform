# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Portfolios::EvidenceMatcher do
  subject(:matcher) do
    turn = Struct.new(:turn_number, :speaker, :text)
    described_class.new([
      turn.new(1, 'ai', 'What did you measure before and after the change?'),
      turn.new(2, 'candidate', 'We cut p95 latency from 800ms to 120ms, mostly by caching the session lookup.'),
      turn.new(3, 'candidate', 'Saya yang mimpin migrasi ke Postgres, tim-nya empat orang.')
    ])
  end

  it 'finds a verbatim quote and its turn' do
    expect(matcher.match('cut p95 latency from 800ms to 120ms')).to eq(quote: 'cut p95 latency from 800ms to 120ms', turn_number: 2)
  end

  it 'ignores case, punctuation and surrounding quote marks' do
    expect(matcher.match('“We cut P95 latency from 800ms to 120ms — mostly by caching”')).to include(turn_number: 2)
  end

  it 'matches Indonesian text' do
    expect(matcher.match('saya yang mimpin migrasi ke postgres')).to include(turn_number: 3)
  end

  it 'rejects paraphrases' do
    expect(matcher.match('We reduced latency by about 85 percent')).to be_nil
  end

  it 'rejects words the AI said' do
    expect(matcher.match('what did you measure before and after')).to be_nil
  end

  it 'rejects fragments that only match part of a word' do
    expect(matcher.match('ut p95 latenc')).to be_nil
  end

  it 'requires every ellipsis fragment to come from the same turn' do
    expect(matcher.match('We cut p95 latency ... caching the session lookup')).to include(turn_number: 2)
    expect(matcher.match('We cut p95 latency ... migrasi ke Postgres')).to be_nil
  end

  it 'rejects quotes too short to mean anything' do
    expect(matcher.match('caching')).to be_nil
    expect(matcher.match(nil)).to be_nil
  end
end
