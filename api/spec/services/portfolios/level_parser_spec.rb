# frozen_string_literal: true

require 'rails_helper'

# Perbaikan #3 (A3/D5-Backend, P1): `level.to_i.clamp(1, 5)` lama mengarang
# rating pada DUA arah — nil/garbage → 0 → clamp ke 1 (L1, rating terburuk),
# dan 99 → clamp ke 5 (rating terbaik). Aturan yang benar (mirror dari
# web/src/utils/constants.ts parseLevel): tidak bisa diparse dengan jujur →
# nil, JANGAN pernah angka karangan.
RSpec.describe Portfolios::LevelParser do
  describe '.parse' do
    {
      1 => 1, 3 => 3, 5 => 5,
      '3' => 3, 'L3' => 3, 'L5' => 5, 'Level 4' => 4, '05' => 5,
      # semua bentuk yang dulu dijawab dengan angka karangan:
      nil => nil, '' => nil, 'abc' => nil, 'high' => nil,
      0 => nil, 6 => nil, 99 => nil, -1 => nil,
      '3.5' => nil, 2.5 => nil, true => nil
    }.each do |input, expected|
      it "parse(#{input.inspect}) → #{expected.inspect}" do
        expect(described_class.parse(input)).to eq(expected)
      end
    end
  end
end
