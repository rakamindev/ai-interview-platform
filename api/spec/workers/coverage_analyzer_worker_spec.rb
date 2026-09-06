# frozen_string_literal: true

require 'rails_helper'

# Perbaikan #2 (A2, P0): `advance_stale_partials` lama menulis state 'covered'
# dan menimpa last_signal dengan string robot — padahal last_signal dibaca
# portfolio generator sebagai EVIDENCE penilaian kandidat. Sekarang worker
# tidak menulis apa pun: skill tetap partial, kestagnan dilaporkan lewat
# log terstruktur supaya tetap terlihat oleh ops.
RSpec.describe CoverageAnalyzerWorker do
  let(:session) { create(:session) }

  let(:analyzer_result) { { skill_updates: [], discovered_skills: [] } }

  before do
    analyzer = instance_double(Coverage::Analyzer, call: analyzer_result)
    allow(Coverage::Analyzer).to receive(:new).with(session: session).and_return(analyzer)
    allow(Sidekiq).to receive(:redis).and_yield(instance_double(Redis, publish: nil))
    allow(Rails.logger).to receive(:warn)
    allow(Rails.logger).to receive(:info)
  end

  def perform
    described_class.new.perform(session.id, 1)
  end

  context 'dengan skill partial yang staleness-nya layak dilaporkan (probe_count >= 4)' do
    let!(:map) { create(:coverage_map, session: session, state: 'partial', probe_count: 4, last_signal: 'Candidate walked through a real outage postmortem') }

    it 'TIDAK mengubah state menjadi covered — dulu di-sini pengarangan terjadi' do
      perform
      expect(map.reload.state).to eq('partial')
    end

    it 'TIDAK menimpa last_signal dengan string robot' do
      perform
      expect(map.reload.last_signal).to eq('Candidate walked through a real outage postmortem')
    end

    it 'melaporkan kestagnan lewat log terstruktur' do
      perform
      expect(Rails.logger).to have_received(:warn).with(
        a_string_matching(/stale partial/).and(a_string_matching("session_id=#{session.id}"))
                                            .and(a_string_matching(map.skill_label))
      )
    end
  end

  context 'dengan skill partial yang masih dalam jangkauan analyzer (probe_count < 4)' do
    let!(:map) { create(:coverage_map, session: session, state: 'partial', probe_count: 2) }

    it 'tidak dilaporkan stale dan tidak diubah' do
      perform
      expect(map.reload.state).to eq('partial')
      expect(Rails.logger).not_to have_received(:warn).with(a_string_matching(/stale partial/))
    end
  end

  context 'dengan skill yang baru saja dibahas di run yang sama (exclude_ids)' do
    let!(:map) { create(:coverage_map, session: session, state: 'partial', probe_count: 4) }

    let(:analyzer_result) do
      { skill_updates: [{ coverage_map_id: map.id, skill_id: map.skill_id, skill_label: map.skill_label,
                          new_state: 'partial', new_probe_count: 4, last_signal: 'just discussed' }],
        discovered_skills: [] }
    end

    it 'tidak dilaporkan stale' do
      perform
      expect(Rails.logger).not_to have_received(:warn).with(a_string_matching(/stale partial/))
    end
  end

  context 'dengan skill covered dan not_yet' do
    let!(:covered) { create(:coverage_map, session: session, state: 'covered', probe_count: 9, skill_label: 'Covered Skill') }
    let!(:not_yet) { create(:coverage_map, session: session, state: 'not_yet', probe_count: 0, skill_label: 'Untouched Skill') }

    it 'tidak menyentuh keduanya' do
      perform
      expect(covered.reload.state).to eq('covered')
      expect(not_yet.reload.state).to eq('not_yet')
    end
  end

  context 'ketika session sudah ended' do
    it 'berhenti tanpa memanggil analyzer' do
      session.update!(status: 'ended')
      perform
      expect(Coverage::Analyzer).not_to have_received(:new)
    end
  end

  context 'ketika session tidak ditemukan' do
    it 'tidak melempar — job ini non-kritis' do
      expect { described_class.new.perform(999_999, 1) }.not_to raise_error
    end
  end
end
