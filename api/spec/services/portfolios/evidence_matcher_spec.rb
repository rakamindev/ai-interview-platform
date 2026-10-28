# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Portfolios::EvidenceMatcher do
  Turn = Struct.new(:turn_number, :text)

  let(:turns) do
    [
      Turn.new(2, 'At my last job we built a real-time dashboard for logistics tracking.'),
      Turn.new(4, 'We moved critical real-time data into useRef, um, for things that do not need to trigger renders.'),
      Turn.new(6, 'Saya biasanya menulis dokumen satu halaman sebelum rapat keputusan besar.')
    ]
  end

  subject(:matcher) { described_class.new(turns) }

  it 'matches an exact quote and reports its turn' do
    match = matcher.match('we built a real-time dashboard for logistics tracking')
    expect(match.turn_number).to eq(2)
  end

  it 'ignores casing, curly quotes and punctuation differences' do
    match = matcher.match('“We moved critical real-time data into useRef”')
    expect(match).to have_attributes(turn_number: 4, quote: '“We moved critical real-time data into useRef”')
  end

  it 'tolerates a dropped filler word' do
    expect(matcher.match('We moved critical real-time data into useRef for things that do not need to trigger renders')&.turn_number)
      .to eq(4)
  end

  it 'matches Bahasa Indonesia quotes' do
    expect(matcher.match('menulis dokumen satu halaman sebelum rapat')&.turn_number).to eq(6)
  end

  it 'rejects a quote the candidate never said' do
    expect(matcher.match('I always write a one-pager before big decisions')).to be_nil
  end

  it 'rejects quotes too short to be meaningful evidence' do
    expect(matcher.match('useRef')).to be_nil
  end

  it 'rejects non-string evidence' do
    expect(matcher.match(nil)).to be_nil
    expect(matcher.match({ 'text' => 'We moved critical data' })).to be_nil
  end

  # A fabricated quote made of common words must not "match" just because a
  # long answer happens to contain those words far apart.
  it 'does not accept scattered common words in a long turn as a match' do
    long_answer = Turn.new(8, ([
      'I think the team had a lot of work to do and we tried to plan it well',
      'so I worked with the designers and then I wrote the code for the new page',
      'and later we had to make sure the system would scale for all of our users'
    ] * 3).join(' '))
    fabricated = 'I made the team scale the system for all users'

    expect(described_class.new([long_answer]).match(fabricated)).to be_nil
  end
end
