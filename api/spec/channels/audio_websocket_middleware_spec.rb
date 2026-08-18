# frozen_string_literal: true

require 'rails_helper'

RSpec.describe AudioWebSocketMiddleware do
  subject(:middleware) { described_class.new(->(_env) { [404, {}, []] }) }

  let(:session) { create(:session, status: 'active') }
  let(:browser_ws) { instance_double(Faye::WebSocket, send: nil) }
  let(:gemini_client) { instance_double(Gemini::LiveClient) }

  let(:state) do
    AudioWebSocketMiddleware::ConnectionState.new.tap do |s|
      s.session = session
      s.gemini_client = gemini_client
    end
  end

  # F19 slice — typed-answer fallback, sent over the audio WS as a
  # {"type":"text_input"} browser message, forwarded to Gemini as a genuine
  # clientContent turn via Gemini::LiveClient#send_text_turn (not the silent
  # realtimeInput.text channel used for coverage/wrap-up signals).
  describe '#handle_text_input (private)' do
    def send_text_input(text)
      middleware.send(:handle_text_input, text, browser_ws, state)
    end

    context "with a non-blank answer while it is the candidate's turn" do
      before { allow(gemini_client).to receive(:send_text_turn).and_return(true) }

      it 'forwards the text to Gemini via send_text_turn' do
        send_text_input("I'd use a message queue to decouple the services.")

        expect(gemini_client).to have_received(:send_text_turn)
          .with("I'd use a message queue to decouple the services.")
      end

      it 'persists the answer as a candidate TranscriptTurn' do
        expect { send_text_input("I'd use a message queue.") }
          .to change { session.transcript_turns.where(speaker: 'candidate').count }.by(1)

        turn = session.transcript_turns.order(:turn_number).last
        expect(turn.text).to eq("I'd use a message queue.")
        expect(turn.speaker).to eq('candidate')
      end

      it 'echoes the transcription back to the browser so it renders as a bubble' do
        send_text_input("I'd use a message queue.")

        expect(browser_ws).to have_received(:send) do |payload|
          parsed = JSON.parse(payload)
          expect(parsed['type']).to eq('transcription')
          expect(parsed['speaker']).to eq('candidate')
          expect(parsed['text']).to eq("I'd use a message queue.")
        end
      end
    end

    context 'with a blank answer' do
      before { allow(gemini_client).to receive(:send_text_turn) }

      it 'does not forward blank text to Gemini' do
        send_text_input('   ')

        expect(gemini_client).not_to have_received(:send_text_turn)
      end

      it 'does not create a TranscriptTurn' do
        expect { send_text_input('   ') }
          .not_to(change { TranscriptTurn.count })
      end

      it 'handles nil text the same way' do
        expect { send_text_input(nil) }.not_to(change { TranscriptTurn.count })
      end
    end

    context 'while the AI is mid-turn (model_speaking)' do
      before do
        state.model_speaking = true
        allow(gemini_client).to receive(:send_text_turn)
      end

      it 'does not forward the text to Gemini (prevents a dual turn)' do
        send_text_input('interrupting answer')

        expect(gemini_client).not_to have_received(:send_text_turn)
      end

      it 'does not create a TranscriptTurn' do
        expect { send_text_input('interrupting answer') }
          .not_to(change { TranscriptTurn.count })
      end
    end

    context 'when the session has already ended' do
      before do
        state.ending_scheduled = true
        allow(gemini_client).to receive(:send_text_turn)
      end

      it 'does not forward the text to Gemini' do
        send_text_input('too late')

        expect(gemini_client).not_to have_received(:send_text_turn)
      end

      it 'does not create an orphaned TranscriptTurn' do
        expect { send_text_input('too late') }
          .not_to(change { TranscriptTurn.count })
      end
    end

    context 'when Gemini is not actually connected' do
      before { allow(gemini_client).to receive(:send_text_turn).and_return(false) }

      it 'does not persist a turn for text that was never delivered' do
        expect { send_text_input('hello?') }
          .not_to(change { TranscriptTurn.count })
      end

      it 'sends a recoverable error back to the browser' do
        send_text_input('hello?')

        expect(browser_ws).to have_received(:send) do |payload|
          parsed = JSON.parse(payload)
          expect(parsed['type']).to eq('error')
          expect(parsed['recoverable']).to eq(true)
        end
      end
    end

    it 'stores a very long answer (5000 chars) intact' do
      allow(gemini_client).to receive(:send_text_turn).and_return(true)
      long_text = 'a' * 5000

      send_text_input(long_text)

      expect(session.transcript_turns.order(:turn_number).last.text).to eq(long_text)
    end
  end
end
