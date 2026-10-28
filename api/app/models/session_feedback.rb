# frozen_string_literal: true

class SessionFeedback < ApplicationRecord
  include TenantScoped

  EXPERIENCE_TAGS = %w[smooth technical_issue confusing too_long other].freeze

  belongs_to :session

  validates :rating, presence: true, inclusion: { in: 1..5 }
  validates :experience_tag, inclusion: { in: EXPERIENCE_TAGS }, allow_nil: true, allow_blank: false
  validates :session_id, uniqueness: { message: "has already been submitted for this session" }
  validates :complaint_text, presence: { message: "can't be blank when a complaint is reported" }, if: :has_complaint?

  before_validation :normalize_fields

  private

  def normalize_fields
    self.experience_tag = nil if experience_tag.blank?
    self.complaint_text = nil unless has_complaint?
  end
end
