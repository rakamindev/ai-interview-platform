# frozen_string_literal: true

require 'spec_helper'
# When the whole suite runs, Rails is already booted and Zeitwerk owns these
# constants. Only load them by hand for the database-free subset.
unless defined?(Rails)
  require_relative '../../app/lib/transcript_sanitizer'
end

# Regression guard for the Step 3 P2 that was confirmed live in both the candidate's
# chat bubble and the assessor's Live Monitor.
RSpec.describe TranscriptSanitizer do
  describe '.call' do
    it 'removes a complete coverage payload and keeps the speech around it' do
      text = '{"discovered": [], "time_remaining_minutes": 25, "pacing": "on_track"} ' \
             'Baik, terima kasih atas jawabannya.'

      expect(described_class.call(text)).to eq('Baik, terima kasih atas jawabannya.')
    end

    it 'removes an orphaned fragment whose opening brace was consumed by an earlier chunk' do
      # This is the exact shape reproduced in Step 3: the old implementation only
      # matched text starting with "{", so this fragment reached the transcript verbatim.
      text = ', "time_remaining_minutes": 25, "pacing": "on_track", ' \
             '"priority_next": "sk-eng-002"} Lanjut ke pertanyaan berikutnya.'

      expect(described_class.call(text)).to eq('Lanjut ke pertanyaan berikutnya.')
    end

    it 'removes a tagged coverage block' do
      text = '[COVERAGE_MAP]{"skills":[]}[/COVERAGE_MAP] Halo, selamat datang.'

      expect(described_class.call(text)).to eq('Halo, selamat datang.')
    end

    it 'leaves ordinary speech untouched' do
      text = 'Halo, nama saya Kaira dan saya seorang backend engineer.'

      expect(described_class.call(text)).to eq(text)
    end

    it 'does not eat a candidate quoting code that happens to contain braces' do
      text = 'Saya biasanya pakai useState({ count: 0 }) di komponen React.'

      expect(described_class.call(text)).to eq(text)
    end

    it 'returns an empty string for nil' do
      expect(described_class.call(nil)).to eq('')
    end
  end

  describe TranscriptSanitizer::Stream do
    subject(:stream) { described_class.new }

    it 'holds back a payload split across two chunks and never emits the fragment' do
      expect(stream.push('Oke, saya mengerti. {"discovered": [],')).to eq('Oke, saya mengerti.')
      expect(stream.push(' "time_remaining_minutes": 25, "pacing": "on_track"} Lanjut ya.'))
        .to eq('Lanjut ya.')
      expect(stream).not_to be_pending
    end

    it 'survives a payload split across three chunks' do
      expect(stream.push('{"discovered": [')).to eq('')
      expect(stream.push('], "pacing":')).to eq('')
      expect(stream.push(' "on_track"} Sekarang pertanyaan terakhir.'))
        .to eq('Sekarang pertanyaan terakhir.')
    end

    it 'releases the buffer instead of swallowing speech when an object never closes' do
      stream = described_class.new(max_pending: 40)

      expect(stream.push('Halo {"discovered": [')).to eq('Halo')
      expect(stream.push('a' * 60)).to include('a')
      expect(stream).not_to be_pending
    end
  end
end
