# frozen_string_literal: true

require 'rails_helper'

# Perbaikan #1 (A1, P0): loop lama memakai ulang `probe_count` yang sama di
# setiap anak tangga, jadi SATU panggilan dengan probe_count == 2 mendorong
# not_yet → initiated → partial → covered sekaligus. HARD RULE "butuh >= 2
# probe untuk lewat dari initiated" tidak pernah gagal karena gate-nya
# dievaluasi ulang dengan angka yang sama, bukan dengan probe yang dibuat
# SETELAH masuk state baru.
#
# Kasus kunci (baris "melompat"): dengan implementasi lama, not_yet → covered
# (probe_count == 2) mengembalikan "covered". Dengan perbaikan ini, SATU
# panggilan maksimal maju SATU state: "initiated". Turn transkrip berikutnya
# dapat kesempatan maju satu rung lagi kalau buktinya masih mendukung.
RSpec.describe Coverage::StateEngine do
  describe '.resolve_state' do
    def resolve(current:, proposed:, probes:)
      described_class.resolve_state(current_state: current, proposed_state: proposed, probe_count: probes)
    end

    it 'tidak berubah ketika current == proposed' do
      expect(resolve(current: 'partial', proposed: 'partial', probes: 9)).to eq('partial')
    end

    it 'tidak berubah ketika proposed lebih rendah atau tidak dikenal' do
      expect(resolve(current: 'partial', proposed: 'initiated', probes: 5)).to eq('partial')
      expect(resolve(current: 'partial', proposed: 'bogus', probes: 5)).to eq('partial')
    end

    it 'hanya maju SATU state per panggilan — tidak boleh melompati tangga' do
      # inilah kasus yang membuat versi lama salah (seeded fault akan merah di sini)
      expect(resolve(current: 'not_yet',   proposed: 'covered', probes: 2)).to eq('initiated')
      expect(resolve(current: 'initiated', proposed: 'covered', probes: 2)).to eq('partial')
      expect(resolve(current: 'not_yet',   proposed: 'partial', probes: 5)).to eq('initiated')
    end

    it 'tetap maju satu state yang sah' do
      expect(resolve(current: 'not_yet',   proposed: 'covered', probes: 0)).to eq('initiated')
      expect(resolve(current: 'initiated', proposed: 'covered', probes: 5)).to eq('partial')
      expect(resolve(current: 'partial',   proposed: 'covered', probes: 5)).to eq('covered')
    end

    it 'HARD RULE: tidak boleh mencapai partial/covered dengan probe_count < 2' do
      expect(resolve(current: 'initiated', proposed: 'partial', probes: 1)).to eq('initiated')
      expect(resolve(current: 'initiated', proposed: 'partial', probes: 0)).to eq('initiated')
      expect(resolve(current: 'partial',   proposed: 'covered', probes: 1)).to eq('partial')
      expect(resolve(current: 'initiated', proposed: 'covered', probes: 1)).to eq('initiated')
    end
  end

  describe '.valid_transition?' do
    it 'menolak transisi yang tidak berdekatan' do
      expect(described_class.valid_transition?(from: 'not_yet', to: 'partial', probe_count: 9)).to be(false)
      expect(described_class.valid_transition?(from: 'not_yet', to: 'covered', probe_count: 9)).to be(false)
      expect(described_class.valid_transition?(from: 'covered', to: 'partial', probe_count: 9)).to be(false)
    end

    it 'menerapkan HARD RULE >= 2 probe untuk partial/covered' do
      expect(described_class.valid_transition?(from: 'not_yet',   to: 'initiated', probe_count: 0)).to be(true)
      expect(described_class.valid_transition?(from: 'initiated', to: 'partial',   probe_count: 1)).to be(false)
      expect(described_class.valid_transition?(from: 'initiated', to: 'partial',   probe_count: 2)).to be(true)
      expect(described_class.valid_transition?(from: 'partial',   to: 'covered',   probe_count: 1)).to be(false)
      expect(described_class.valid_transition?(from: 'partial',   to: 'covered',   probe_count: 2)).to be(true)
    end
  end
end
