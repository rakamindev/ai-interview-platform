# frozen_string_literal: true

require 'rails_helper'

# ai_level nullable (migrasi relax_portfolio_skills_ai_level): nil = "AI tidak
# pernah menghasilkan level" dan itu harus valid; angka di luar 1..5 tetap
# ditolak di level model, bukan diem-diam di-clamp.
RSpec.describe PortfolioSkill do
  subject(:skill) { build(:portfolio_skill, attributes) }

  let(:attributes) { {} }

  describe 'ai_level' do
    it 'menerima 1..5' do
      (1..5).each do |level|
        expect(build(:portfolio_skill, ai_level: level)).to be_valid
      end
    end

    it 'menerima nil — belum dinilai bukan kesalahan data' do
      expect(build(:portfolio_skill, ai_level: nil)).to be_valid
    end

    it 'menolak di luar rentang' do
      expect(build(:portfolio_skill, ai_level: 0)).not_to be_valid
      expect(build(:portfolio_skill, ai_level: 6)).not_to be_valid
    end
  end

  describe 'ai_confidence' do
    it 'menolak nilai di luar enum' do
      expect(build(:portfolio_skill, ai_confidence: 'confirmed')).not_to be_valid
    end
  end
end
