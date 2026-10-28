# frozen_string_literal: true

require 'rails_helper'

RSpec.describe FitGap::Coverage do
  def row(result)
    { skill_label: 'X', result: result }
  end

  describe '.summarize' do
    it 'reports 1 of 4 when three skills are not assessed' do
      list = [row('match'), row('not_assessed'), row('not_assessed'), row('not_assessed')]
      expect(described_class.summarize(list)).to eq(
        assessed: 1, total: 4, not_assessed: 3, complete: false
      )
    end

    it 'is complete when every skill was assessed' do
      list = [row('match'), row('gap'), row('exceed')]
      expect(described_class.summarize(list)).to eq(
        assessed: 3, total: 3, not_assessed: 0, complete: true
      )
    end

    it 'handles an empty or nil list without raising' do
      expect(described_class.summarize([])).to eq(assessed: 0, total: 0, not_assessed: 0, complete: true)
      expect(described_class.summarize(nil)).to eq(assessed: 0, total: 0, not_assessed: 0, complete: true)
    end

    it 'accepts string keys as stored in jsonb' do
      list = [{ 'result' => 'not_assessed' }, { 'result' => 'match' }]
      expect(described_class.summarize(list)[:assessed]).to eq(1)
    end
  end

  describe '.fallback_sentence' do
    it 'warns that the result is incomplete when skills were not assessed' do
      list = [row('match'), row('not_assessed'), row('not_assessed'), row('not_assessed')]
      text = described_class.fallback_sentence(list)
      expect(text).to include('1 of 4')
      expect(text).to include('incomplete')
    end

    it 'keeps the original sentence when everything was assessed' do
      text = described_class.fallback_sentence([row('match'), row('gap')])
      expect(text).to eq('Candidate shows 1 skill matches, 0 exceeds, and 1 gaps against role requirements.')
    end
  end
end
