# frozen_string_literal: true

class TranscriptTurn < ApplicationRecord
  include TenantScoped

  SPEAKERS = %w[ai candidate].freeze

  belongs_to :session

  validates :turn_number, presence: true,
                           numericality: { only_integer: true, greater_than: 0 }
  validates :speaker, inclusion: { in: SPEAKERS }
  validates :text, presence: true

  scope :ordered, -> { order(:turn_number) }

  private

  # See Portfolio#assign_tenant_id — must be `=`, not `||=`, because Rails
  # pre-populates tenant_id from the active default_scope before this runs.
  def assign_tenant_id
    self.tenant_id = session&.tenant_id
  end
end
