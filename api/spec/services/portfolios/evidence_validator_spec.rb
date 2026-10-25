# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Portfolios::EvidenceValidator do
  let(:organization) do
    Organization.create!(
      name: 'Citation Corp', scheme: 'citation-test', identifier: 'citation-test', host: 'citation.test.local'
    )
  end
  let(:assessment) do
    Current.using(tenant_id: organization.id) do
      Assessment.create!(name: 'Citation Assessment', created_by: 1, time_limit_min: 30)
    end
  end
  let(:session) do
    Current.using(tenant_id: organization.id) do
      Session.create!(assessment:, candidate_name: 'Citation Candidate', status: 'ended')
    end
  end

  subject(:validator) { described_class.new(session:) }

  def add_turn(number, speaker, text, owner: session)
    owner.transcript_turns.create!(turn_number: number, speaker:, text:)
  end

  it 'returns a canonical excerpt for exact and harmless punctuation differences' do
    turn = add_turn(2, 'candidate', 'I built a server-side queue, then measured its latency.')

    result = validator.call([{ turn_number: 2, quote: 'I built a server side queue then measured its latency' }])

    expect(result[:rejections]).to be_empty
    expect(result[:citations]).to eq([{
      'turn_id' => turn.id,
      'turn_number' => 2,
      'quote' => 'I built a server-side queue, then measured its latency',
      'verification_status' => 'verified'
    }])
  end

  it 'rejects AI turns, missing turns, and materially different quotes' do
    add_turn(1, 'ai', 'How did you validate it?')
    add_turn(2, 'candidate', 'I measured latency under peak load.')

    result = validator.call([
      { turn_number: 1, quote: 'How did you validate it?' },
      { turn_number: 99, quote: 'Missing' },
      { turn_number: 2, quote: 'I delegated all validation to another team.' }
    ])

    expect(result[:citations]).to be_empty
    expect(result[:rejections]).to eq(wrong_speaker: 1, missing_turn: 1, quote_mismatch: 1)
  end

  it 'resolves repeated text by the explicit turn number' do
    add_turn(3, 'candidate', 'I checked the logs.')
    expected = add_turn(4, 'candidate', 'I checked the logs.')

    result = validator.call([{ turn_number: 4, quote: 'I checked the logs.' }])

    expect(result[:citations].first['turn_id']).to eq(expected.id)
  end

  it 'cannot resolve a turn that exists only in another session' do
    other_session = Current.using(tenant_id: organization.id) do
      Session.create!(assessment:, candidate_name: 'Other Candidate', status: 'ended')
    end
    add_turn(8, 'candidate', 'Evidence from another interview.', owner: other_session)

    result = validator.call([{ turn_number: 8, quote: 'Evidence from another interview.' }])

    expect(result[:rejections]).to eq(missing_turn: 1)
  end

  it 'bounds long excerpts on grapheme boundaries' do
    source = Array.new(400, 'é').join(' ')
    add_turn(7, 'candidate', source)

    result = validator.call([{ turn_number: 7, quote: source }])
    excerpt = result[:citations].first['quote']

    expect(excerpt.scan(/\X/).length).to eq(described_class::MAX_EXCERPT_GRAPHEMES)
    expect(source).to start_with(excerpt)
    expect(excerpt.valid_encoding?).to be(true)
  end
end
