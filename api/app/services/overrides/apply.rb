# frozen_string_literal: true

module Overrides
  # Menerapkan override level dari asesor (F-04, F-05):
  # 1. memvalidasi level, alasan, dan status portofolio;
  # 2. dalam SATU transaksi dengan row lock pada skill: memperbarui state terkini
  #    (assessor_overrides) dan menambah satu baris riwayat (assessor_override_events).
  # Bila salah satu gagal, keduanya dibatalkan (tidak ada partial write).
  class Apply
    Result = Struct.new(:override, :event, :created, :error, :status, keyword_init: true) do
      def success? = error.nil?
    end

    class Unchanged < StandardError; end

    def initialize(portfolio_skill:, level:, reason:, actor_id:)
      @skill    = portfolio_skill
      @level    = Integer(level, exception: false)
      @reason   = reason.to_s.strip
      @actor_id = actor_id
    end

    def call
      error = input_error
      return failure(error, :unprocessable_entity) if error

      ActiveRecord::Base.transaction(requires_new: true) { apply! }
    rescue Unchanged
      failure('Override level is unchanged', :unprocessable_entity)
    rescue ActiveRecord::RecordInvalid => e
      failure(e.record.errors.full_messages.first, :unprocessable_entity)
    rescue ActiveRecord::ActiveRecordError
      # Pesan generik: jangan bocorkan detail internal atau isi alasan.
      failure('Could not save the override. Please try again.', :internal_server_error)
    end

    private

    def input_error
      return 'Override level must be in 1..5' unless @level&.between?(1, 5)

      unless AssessorOverrideEvent::REASON_LENGTH.cover?(@reason.length)
        return "Reason must be between #{AssessorOverrideEvent::REASON_LENGTH.min} and " \
               "#{AssessorOverrideEvent::REASON_LENGTH.max} characters"
      end
      return "Portfolio is not ready for overrides (status: #{portfolio.generation_status})" unless portfolio.complete?

      nil
    end

    def apply!
      # SELECT ... FOR UPDATE: dua asesor yang meng-override skill yang sama
      # diproses berurutan, sehingga previous_level selalu akurat.
      @skill.lock!
      current_level = @skill.assessor_override&.override_level || @skill.ai_level
      raise Unchanged if @level == current_level

      override = @skill.assessor_override || @skill.build_assessor_override(ai_level: @skill.ai_level)
      created  = override.new_record?
      override.update!(
        override_level: @level,
        assessor_notes: @reason,
        overridden_by:  @actor_id,
        overridden_at:  Time.current
      )

      event = @skill.assessor_override_events.create!(
        previous_level: current_level,
        new_level:      @level,
        ai_level:       @skill.ai_level,
        reason:         @reason,
        actor_id:       @actor_id
      )

      Result.new(override:, event:, created:)
    end

    def portfolio
      @portfolio ||= @skill.portfolio
    end

    def failure(message, status)
      Result.new(error: message, status:)
    end
  end
end
