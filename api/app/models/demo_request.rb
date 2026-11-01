# frozen_string_literal: true

# A visitor's request for a product demo, submitted from the public landing page. Not tenant-scoped:
# the visitor has no account yet.
class DemoRequest < ApplicationRecord
  MAX_FIELD_LENGTH = 255
  MAX_MESSAGE_LENGTH = 1000
  EMAIL_FORMAT = /\A\S+@\S+\.\S+\z/

  before_validation :strip_text

  validates :name, :company, presence: true, length: { maximum: MAX_FIELD_LENGTH }
  validates :email, presence: true, length: { maximum: MAX_FIELD_LENGTH },
                    format: { with: EMAIL_FORMAT }
  validates :message, length: { maximum: MAX_MESSAGE_LENGTH }

  private

  def strip_text
    self.name = clean_text(name)
    self.email = clean_text(email)
    self.company = clean_text(company)
    self.message = clean_text(message).presence
  end

  # PostgreSQL rejects null bytes in text columns.
  def clean_text(value)
    value&.delete("\u0000")&.strip
  end
end
