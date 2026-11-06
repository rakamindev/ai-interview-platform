# frozen_string_literal: true

class FitGapReport < ApplicationRecord
  FIT_RESULTS = %w[match gap exceed not_assessed].freeze
  REGENERATION_COOLDOWN = 2.minutes
  # Generik: tidak boleh memuat pesan exception (bisa berisi data kandidat).
  FAILURE_MESSAGE = 'The report could not be updated. Showing the previous version.'

  belongs_to :portfolio
  belongs_to :vacancy

  validates :skill_comparisons, presence: true

  # Menandai laporan perlu diperbarui lalu mengantrekan regenerasi (F-09).
  # - force: true dipakai setelah override: selalu antrekan, karena worker idempoten.
  # - tanpa force (saat laporan dibaca): dibatasi cooldown agar tidak membanjiri Gemini.
  # update_all bersyarat bersifat atomik, sehingga dua request bersamaan tidak
  # sama-sama mengantrekan job di dalam jendela cooldown.
  def request_regeneration!(force: false)
    scope = self.class.where(id:)
    unless force
      scope = scope.where('regeneration_requested_at IS NULL OR regeneration_requested_at < ?',
                          REGENERATION_COOLDOWN.ago)
    end
    return false if scope.update_all(stale: true, regeneration_requested_at: Time.current).zero?

    FitGapGeneratorWorker.perform_async(portfolio_id, vacancy_id)
    true
  end

  # Laporan sudah mencerminkan override terbaru → job regenerasi boleh dilewati.
  def fresh_for?(latest_override_at)
    !stale && self.class.same_instant?(based_on_override_at, latest_override_at)
  end

  def self.same_instant?(left, right)
    return left.nil? && right.nil? if left.nil? || right.nil?

    (left - right).abs < 0.001
  end
end
