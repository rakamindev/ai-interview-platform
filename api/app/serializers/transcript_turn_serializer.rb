# frozen_string_literal: true

class TranscriptTurnSerializer
  def initialize(turn)
    @turn = turn
  end

  def as_json(**)
    {
      id:             turn.id,
      turn_number:    turn.turn_number,
      speaker:        turn.speaker,
      text:           turn.text,
      audio_start_ms: turn.audio_start_ms,
      audio_end_ms:   turn.audio_end_ms,
      created_at:     turn.created_at
    }
  end

  private

  attr_reader :turn
end
