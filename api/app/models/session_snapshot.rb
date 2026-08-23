# frozen_string_literal: true

class SessionSnapshot < ApplicationRecord
  RETENTION_PERIOD = 90.days

  belongs_to :session

  validates :image_data, presence: true
  validates :captured_at, presence: true

  def self.purge_expired!
    where("captured_at < ?", RETENTION_PERIOD.ago).delete_all
  end
end
