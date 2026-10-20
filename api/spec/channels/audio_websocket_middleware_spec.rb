# frozen_string_literal: true

require 'rails_helper'

# The audio proxy between the candidate's browser and Gemini Live: who may connect, what reaches the
# model, the echo gate, transcripts, reconnects and every way an interview ends. Neither socket is real
# (spec/support/audio_socket_doubles.rb). EventMachine timers are collected instead of scheduled, so a
# spec fires them when it wants, and background threads run inline so their database writes are visible.
RSpec.describe AudioWebSocketMiddleware do
  let(:app)        { ->(_env) { [200, {}, ['passed on']] } }
  let(:middleware) { described_class.new(app) }
  let(:browser)    { AudioSocketDoubles::FakeBrowserSocket.new }
  let(:clients)    { [] }
  let(:timers)     { [] }
  let(:company)    { create(:organization) }
  let(:assessment) do
    create(:assessment, :with_skills, organization: company, time_limit_min: 30, system_prompt: 'You are the interviewer.')
  end
  let(:session) { create(:session, assessment:) }

  before do
    allow(Faye::WebSocket).to receive(:websocket?).and_return(true)
    allow(Faye::WebSocket).to receive(:new).and_return(browser)
    allow(Gemini::LiveClient).to receive(:new) do |**callbacks|
      AudioSocketDoubles::FakeLiveClient.new(**callbacks).tap { clients << _1 }
    end
    allow(EM).to receive(:add_timer) { |delay, &block| timers << [delay, block] }
    allow(EM::Timer).to receive(:new) do |delay, &block|
      timers << [delay, block]
      double('EM::Timer', cancel: nil)
    end
    allow(EM).to receive(:schedule) { |&block| block.call }
    allow(Thread).to receive(:new) { |&block| block.call }
  end

  def audio_env(session_id: session.id, query: "token=#{session.invite_token}", headers: {})
    Rack::MockRequest.env_for("/ws/sessions/#{session_id}/audio?#{query}", headers)
  end

  def connect(**)
    middleware.call(audio_env(**))
    browser.fire(:open)
  end

  def gemini = clients.last

  # Fires the collected timers with this delay (all of them when nil), including any they schedule.
  def fire_timers(delay = nil)
    due, timers[0..] = timers.partition { |d, _| delay.nil? || d == delay }
    due.each { |_, block| block.call }
  end

  def candidate_says(text) = gemini.emit(:on_input_transcription, text)

  def ai_says(text) = gemini.emit(:on_output_transcription, text)

  describe 'routing' do
    it 'passes a plain HTTP request on the audio path to the app' do
      allow(Faye::WebSocket).to receive(:websocket?).and_return(false)

      expect(middleware.call(audio_env)).to eq([200, {}, ['passed on']])
    end

    it 'passes a WebSocket on any other path to the app' do
      env = Rack::MockRequest.env_for("/ws/sessions/#{session.id}/coverage")

      expect(middleware.call(env)).to eq([200, {}, ['passed on']])
      expect(Faye::WebSocket).not_to have_received(:new)
    end

    it 'answers the upgrade with the socket’s Rack response' do
      expect(middleware.call(audio_env)).to eq([-1, {}, []])
    end
  end

  describe 'who may connect' do
    it 'opens Gemini with the assessment’s prompt for a valid invite link, and starts the session' do
      connect

      expect(Gemini::LiveClient).to have_received(:new).with(hash_including(system_prompt: 'You are the interviewer.'))
      expect(gemini.connects).to eq([nil])
      expect(session.reload).to be_active
      expect(session.coverage_maps.pluck(:skill_label)).to contain_exactly('React', 'Communication', 'System Design')
    end

    it 'resumes the stored Gemini session after a page refresh' do
      session.update!(status: 'active', started_at: 3.minutes.ago, gemini_resumption_token: 'resume-1')

      connect

      expect(gemini.connects).to eq(['resume-1'])
    end

    it 'connects with an assessor’s token for a session in their company' do
      token = JsonWebToken.encode({ user_id: 1, role: 'admin', scheme: company.scheme }, 1.hour)

      connect(query: '', headers: { 'HTTP_AUTHORIZATION' => "Bearer #{token}" })

      expect(clients.size).to eq(1)
    end

    {
      'an unknown invite token' => [{ query: 'token=not-a-token' }, 'Session not found'],
      'no token and no header' => [{ query: '' }, 'Missing authorization'],
      'an invite token for another session' => [{ session_id: 999_999 }, 'Session ID mismatch']
    }.each do |label, (args, message)|
      it "refuses #{label}: an error the page can show, the socket closed, Gemini never opened" do
        connect(**args)

        expect(browser.messages).to eq([{ 'type' => 'error', 'code' => 'auth_failed', 'message' => message,
                                          'recoverable' => false }])
        expect(browser).to be_closed
        expect(clients).to be_empty
      end
    end

    it 'refuses a session that has ended' do
      session.update!(status: 'ended', end_reason: 'manual_candidate')

      connect

      expect(browser.messages.first).to include('code' => 'auth_failed', 'message' => 'Session has ended')
      expect(clients).to be_empty
    end

    it 'refuses an assessor from another company, without saying the session exists' do
      token = JsonWebToken.encode({ user_id: 1, role: 'admin', scheme: create(:organization).scheme }, 1.hour)

      connect(query: '', headers: { 'HTTP_AUTHORIZATION' => "Bearer #{token}" })

      expect(browser.messages.first).to include('code' => 'auth_failed', 'message' => 'Session not found')
      expect(clients).to be_empty
    end

    it 'compiles a missing system prompt instead of starting with none' do
      assessment.update_column(:system_prompt, nil)

      connect

      expect(assessment.reload.system_prompt).to be_present
      expect(Gemini::LiveClient).to have_received(:new).with(hash_including(system_prompt: assessment.system_prompt))
    end
  end

  describe 'the opening' do
    it 'lets the AI speak first on a new interview, then tells the page it started' do
      connect
      gemini.emit(:on_ready)

      expect(gemini).to be_opening_triggered
      expect(browser.messages).to eq([{ 'type' => 'speaker_changed', 'speaker' => 'ai' },
                                      { 'type' => 'session_started', 'session_id' => session.id }])
    end

    it 'does not greet again when it resumes an interview' do
      session.update!(status: 'active', started_at: 3.minutes.ago, gemini_resumption_token: 'resume-1')
      connect
      gemini.emit(:on_ready)

      expect(gemini).not_to be_opening_triggered
      expect(browser.types).to eq(['session_started'])
    end
  end

  describe 'audio from the browser' do
    before do
      connect
      gemini.emit(:on_ready)
      gemini.emit(:on_model_turn_complete)
    end

    it 'forwards a microphone frame to Gemini' do
      browser.fire(:message, "\x01\x02\x03\x04".b)

      expect(gemini.audio).to eq(["\x01\x02\x03\x04".b])
    end

    it 'holds the microphone back while the AI is speaking, so the speaker doesn’t echo into it' do
      gemini.emit(:on_audio, "\x10\x00".b)
      browser.fire(:message, "\x01\x02".b)
      gemini.emit(:on_model_turn_complete)
      browser.fire(:message, "\x03\x04".b)

      expect(gemini.audio).to eq(["\x03\x04".b])
    end

    it 'drops audio quietly while Gemini isn’t ready' do
      gemini.accepting = false

      expect { browser.fire(:message, "\x01\x02".b) }.not_to raise_error
      expect(gemini.audio).to be_empty
    end

    it 'forwards a frame whose first byte happens to be "{" (0x7B)' do
      frame = "{\x00\xFF\x7F".b
      browser.fire(:message, frame)

      expect(gemini.audio).to eq([frame])
    end
  end

  describe 'audio and transcripts from Gemini' do
    before do
      connect
      gemini.emit(:on_ready)
      gemini.emit(:on_model_turn_complete)
      browser.sent.clear
    end

    it 'plays the AI’s audio in the browser, saying once per turn that the AI is speaking' do
      gemini.emit(:on_audio, "\x01\x02".b)
      gemini.emit(:on_audio, "\x03\x04".b)

      expect(browser.audio).to eq([[1, 2], [3, 4]])
      expect(browser.messages).to eq([{ 'type' => 'speaker_changed', 'speaker' => 'ai' }])
    end

    it 'hands the turn back to the candidate when the AI finishes' do
      gemini.emit(:on_audio, "\x01".b)
      gemini.emit(:on_model_turn_complete)

      expect(browser.messages.last).to eq('type' => 'speaker_changed', 'speaker' => 'candidate')
    end

    it 'saves and shows the candidate’s turn, queues coverage analysis and sends the coverage map once' do
      candidate_says('I profiled with React DevTools.')
      candidate_says('Then I memoised the list.')

      expect(session.transcript_turns.order(:turn_number).pluck(:turn_number, :speaker, :text)).to eq(
        [[1, 'candidate', 'I profiled with React DevTools.'], [2, 'candidate', 'Then I memoised the list.']]
      )
      expect(browser.messages.first).to eq('type' => 'transcription', 'speaker' => 'candidate',
                                           'text' => 'I profiled with React DevTools.', 'turn_number' => 1)
      expect(CoverageAnalyzerWorker.jobs.map { _1['args'] }).to eq([[session.id, 1], [session.id, 2]])
      expect(gemini.injected.grep(/skills_remaining/).size).to eq(1)
    end

    it 'numbers turns on from the saved transcript when the page reconnects' do
      create(:transcript_turn, session:, turn_number: 7)
      again = AudioSocketDoubles::FakeBrowserSocket.new
      allow(Faye::WebSocket).to receive(:new).and_return(again)
      middleware.call(audio_env)
      again.fire(:open)

      candidate_says('Picking up where we left off.')

      expect(session.transcript_turns.maximum(:turn_number)).to eq(8)
    end

    it 'keeps the instructions it sent Gemini out of the AI’s transcript' do
      ai_says("[COVERAGE MAP]{\"skills\":[]}[/COVERAGE MAP] [TIME CONTROL:SYS-TC-7x9k] { \"wrap_up\": true }\n" \
              'Thanks, that makes sense. How did you measure it?')

      expect(session.transcript_turns.pluck(:speaker, :text)).to eq([['ai', 'Thanks, that makes sense. How did you measure it?']])
      expect(browser.messages.last['text']).to eq('Thanks, that makes sense. How did you measure it?')
    end

    it 'saves nothing when an AI transcript is only instructions' do
      ai_says('[TIME CONTROL:SYS-TC-7x9k] { "time_warning": true }')

      expect(session.transcript_turns).to be_empty
      expect(browser.sent).to be_empty
    end
  end

  describe 'control messages' do
    before do
      connect
      gemini.emit(:on_ready)
    end

    it 'ends the interview when the candidate presses End, and closes both sockets' do
      browser.fire(:message, { type: 'end_session' }.to_json)

      expect(session.reload).to have_attributes(status: 'ended', end_reason: 'manual_candidate')
      expect(browser.messages.last).to eq('type' => 'session_ended', 'reason' => 'manual_candidate')
      expect(gemini).to be_closed
      expect(browser).to be_closed
    end

    it 'records a camera or screen-share stop that the candidate page reports' do
      browser.fire(:message, { type: 'proctoring', event: 'screen_stopped' }.to_json)

      expect(session.reload.proctoring_events.pluck('event')).to eq(['screen_stopped'])
      expect(session).to be_active
    end

    it 'ignores a proctoring event it does not know' do
      browser.fire(:message, { type: 'proctoring', event: 'end_interview' }.to_json)

      expect(session.reload.proctoring_events).to be_empty
    end

    it 'ignores a malformed control message' do
      expect { browser.fire(:message, '{not json') }.not_to raise_error
      expect(session.reload).to be_active
    end

    it 'ignores the debug reconnect outside development' do
      browser.fire(:message, { type: 'debug_force_reconnect' }.to_json)

      expect(clients.size).to eq(1)
      expect(timers.map(&:first)).not_to include(1)
    end
  end

  describe 'when Gemini drops' do
    before do
      connect
      gemini.emit(:on_ready)
      gemini.emit(:on_model_turn_complete)
      browser.sent.clear
    end

    it 'does nothing on a normal close' do
      gemini.emit(:on_close, code: 1000, reason: 'bye')

      expect(browser.sent).to be_empty
      expect(timers.map(&:first)).not_to include(1)
    end

    it 'reconnects with the latest resumption token, backing off 1, 2 and 4 seconds' do
      gemini.emit(:on_resumption_token_update, 'resume-2')

      delays = 3.times.map do
        gemini.emit(:on_close, code: 1011, reason: 'internal')
        delay = timers.last.first
        fire_timers(delay)
        delay
      end

      expect(delays).to eq([1, 2, 4])
      expect(clients.drop(1).map(&:connects)).to eq([['resume-2']] * 3)
      expect(browser.types.count('reconnecting')).to eq(1)
    end

    it 'tells the page it is back once Gemini is ready again' do
      gemini.emit(:on_close, code: 1011, reason: 'internal')
      fire_timers(1)
      gemini.emit(:on_ready)

      expect(browser.types).to eq(%w[reconnecting reconnected speaker_changed])
    end

    it 'ends the session as an error after three failed reconnects, and says so' do
      4.times do
        gemini.emit(:on_close, code: 1011, reason: 'internal')
        fire_timers
      end

      expect(session.reload).to have_attributes(status: 'ended', end_reason: 'error')
      expect(browser.messages.last).to include('type' => 'session_ended', 'reason' => 'error')
      expect(browser).to be_closed
    end

    it 'moves to a new Gemini connection on GoAway, carrying the token over' do
      old = gemini
      old.emit(:on_go_away, time_left: 10, resumption_token: 'resume-3')

      expect(session.reload.gemini_resumption_token).to eq('resume-3')
      expect(gemini).not_to equal(old)
      expect(gemini.connects).to eq(['resume-3'])
      expect(old).to be_superseded.and be_closed
      expect(browser.types).to eq(['reconnecting'])
    end
  end

  describe 'the time limit' do
    before do
      connect
      gemini.emit(:on_ready)
      gemini.emit(:on_model_turn_complete)
    end

    def at(minutes_in, &) = travel_to(session.reload.started_at + minutes_in.minutes, &)

    it 'warns the AI at two minutes left and asks it to wrap up at one, once each' do
      at(28.5) { candidate_says('First answer.') }
      at(28.6) { candidate_says('Second answer.') }
      at(29.5) { candidate_says('Third answer.') }

      expect(gemini.injected.grep(/TIME CONTROL/)).to eq(
        ['[TIME CONTROL:SYS-TC-7x9k] { "time_warning": true }', '[TIME CONTROL:SYS-TC-7x9k] { "wrap_up": true }']
      )
    end

    it 'sends a warning again on the next turn if Gemini didn’t take it' do
      gemini.deliver = false
      at(28.5) { candidate_says('First answer.') }
      gemini.deliver = true
      at(28.6) { candidate_says('Second answer.') }

      expect(gemini.injected.grep(/time_warning/).size).to eq(2)
    end

    it 'ends the interview a minute after the limit, as time_ceiling' do
      at(30.5) { candidate_says('One more thing.') }
      at(31.5) { fire_timers(60) }

      expect(session.reload).to have_attributes(status: 'ended', end_reason: 'time_ceiling')
      expect(browser.messages.last).to eq('type' => 'session_ended', 'reason' => 'time_ceiling')
    end
  end

  describe 'when the browser leaves' do
    before do
      connect
      gemini.emit(:on_ready)
    end

    it 'keeps Gemini open for two minutes, then ends the session as an error' do
      browser.fire(:close, code: 1006)

      expect(timers.map(&:first)).to include(120)
      fire_timers(120)

      expect(session.reload).to have_attributes(status: 'ended', end_reason: 'error')
      expect(gemini).to be_closed
    end

    it 'leaves a session alone that ended during the grace period' do
      browser.fire(:close, code: 1006)
      Sessions::EndHandler.new(session).call(reason: 'manual_assessor')

      fire_timers(120)

      expect(session.reload.end_reason).to eq('manual_assessor')
    end
  end

  describe 'when the AI closes the interview' do
    before do
      connect
      gemini.emit(:on_ready)
      gemini.emit(:on_model_turn_complete)
      browser.sent.clear
    end

    it 'notices a closing line in Indonesian and finishes even if Gemini never ends its turn' do
      ai_says('Terima kasih atas waktunya, semoga sukses!')
      fire_timers(15)

      expect(browser.types).to include('preparing_to_end')
      expect(timers.map(&:first)).to include(1)
    end

    it 'records that it asked the page to finish, so the invite link alone cannot end the interview (P1-10)' do
      expect(session.reload.ending_requested_at).to be_nil

      ai_says('Thanks for your time, you’ll hear back from the team.')
      gemini.emit(:on_model_turn_complete)

      expect(browser.types).to include('preparing_to_end')
      expect(session.reload.ending_requested_at).to be_within(5.seconds).of(Time.current)
    end

    it 'closes the socket once the session has ended, telling the page why' do
      ai_says('Thanks for your time, you’ll hear back from the team.')
      gemini.emit(:on_model_turn_complete)
      Sessions::EndHandler.new(session).call(reason: 'all_covered')
      fire_timers(1)
      fire_timers(0.3)

      expect(browser.messages.last).to eq('type' => 'session_ended', 'reason' => 'all_covered')
      expect(browser).to be_closed
    end

    it 'waits for the candidate’s answer before wrapping up when the AI ended on a question' do
      session.coverage_maps.update_all(state: 'covered', probe_count: 2)
      candidate_says('That covers the last skill.')
      ai_says('Great. And how would you test that?')
      gemini.emit(:on_model_turn_complete)

      expect(gemini.injected.grep(/all_skills_covered/)).to be_empty
      candidate_says('With an integration test.')

      expect(gemini.injected.grep(/all_skills_covered/).size).to eq(1)
    end
  end
end
