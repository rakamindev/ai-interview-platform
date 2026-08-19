# frozen_string_literal: true

class InterviewRecording < ApplicationRecord
  RETENTION_DAYS = 30

  belongs_to :session

  validates :object_key, :content_type, :checksum, :captured_at, :expires_at, presence: true
  validates :byte_size, numericality: { only_integer: true, greater_than: 0 }

  def available?
    purged_at.nil? && expires_at.future?
  end
end
