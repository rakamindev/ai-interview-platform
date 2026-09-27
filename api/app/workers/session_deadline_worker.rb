# frozen_string_literal: true

class SessionDeadlineWorker
  include Sidekiq::Worker

  sidekiq_options queue: :default, retry: 3

  BUFFER = 5.minutes

  def self.schedule_for(session)
    perform_at(deadline_for(session), session.id)
  end

  def self.deadline_for(session)
    session.started_at + session.assessment.time_limit_min.minutes + BUFFER
  end

  def self.end_overdue_sessions
    Session.unscoped.active.find_each.select { |session| new.perform(session.id) }.map(&:id)
  end

  def perform(session_id)
    session = Session.unscoped.find_by(id: session_id)
    return false unless session&.active? && session.started_at
    return false if Time.current < self.class.deadline_for(session)

    if session.transcript_turns.exists?(speaker: 'candidate')
      Sessions::EndHandler.new(session).call(reason: 'time_ceiling')
    else
      Sessions::EndHandler.new(session).call(reason: 'error', failure_code: 'candidate_disconnected')
    end
    true
  end
end
