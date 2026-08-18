# frozen_string_literal: true

class AssessorOverride < ApplicationRecord
  include TenantScopedThrough

  belongs_to :portfolio_skill

  tenant_scoped_through(portfolio_skill: { portfolio: :session })

  # ai_level is what the model said when the assessor disagreed. It is nil
  # when the model produced no rating at all, which is exactly the case where
  # a human judgement is most valuable. See migration 20260819000002.
  validates :ai_level,       numericality: { only_integer: true, in: 1..5 }, allow_nil: true
  validates :override_level, numericality: { only_integer: true, in: 1..5 }
  validates :overridden_by,  presence: true

  # The assessor supplied a level where the model had none, rather than
  # correcting one it produced.
  def fills_gap? = ai_level.nil?
end
