# frozen_string_literal: true

class FitGapGeneratorWorker
  include Sidekiq::Worker

  sidekiq_options queue: :default, retry: 2

  def perform(portfolio_id, vacancy_id)
    portfolio = Portfolio.find(portfolio_id)
    vacancy   = Vacancy.unscoped.find(vacancy_id)
    report    = FitGapReport.find_by(portfolio_id:, vacancy_id:)

    # Idempoten (F-09): job ganda dari override beruntun atau retry dilewati bila
    # laporan sudah mencerminkan override terbaru, tanpa memanggil Gemini lagi.
    if report&.fresh_for?(portfolio.latest_override_at)
      Rails.logger.info("[N13] Fit/gap already up to date, skipping: portfolio=#{portfolio_id} vacancy=#{vacancy_id}")
      return
    end

    FitGap::Engine.new(portfolio:, vacancy:).call
  rescue ActiveRecord::RecordNotFound => e
    Rails.logger.warn("[N13] Record not found: #{e.message}")
  rescue StandardError => e
    # Laporan lama tetap tersedia (tidak dihapus); simpan pesan generik untuk UI.
    FitGapReport.where(portfolio_id:, vacancy_id:)
                .update_all(generation_error: FitGapReport::FAILURE_MESSAGE, regeneration_requested_at: nil)
    # Hanya kelas error yang dicatat: pesan exception bisa memuat data kandidat.
    Rails.logger.error("[N13] FitGapGeneratorWorker failed for portfolio=#{portfolio_id} vacancy=#{vacancy_id}: #{e.class}")
    raise
  end
end
