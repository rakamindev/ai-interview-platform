# frozen_string_literal: true

class Vacancy < ApplicationRecord
  include TenantScoped

  has_many :vacancy_skills, dependent: :destroy
  has_many :fit_gap_reports, dependent: :destroy

  validates :role_title, presence: true

  accepts_nested_attributes_for :vacancy_skills,
                                 allow_destroy: true,
                                 reject_if: :all_blank

  before_save :sync_workplace_and_employment_metadata

  def employment_type
    meta = read_metadata("employment_type")
    return meta if meta.present?

    if has_attribute?(:employment_type) && read_attribute(:employment_type).present?
      read_attribute(:employment_type)
    else
      @virtual_employment_type || "full_time"
    end
  end

  def employment_type=(val)
    @virtual_employment_type = val
    if has_attribute?(:employment_type)
      write_attribute(:employment_type, val)
    end
  end

  def workplace_type
    meta = read_metadata("workplace_type")
    return meta if meta.present?

    if has_attribute?(:workplace_type) && read_attribute(:workplace_type).present?
      read_attribute(:workplace_type)
    else
      @virtual_workplace_type || "on_site"
    end
  end

  def workplace_type=(val)
    @virtual_workplace_type = val
    if has_attribute?(:workplace_type)
      write_attribute(:workplace_type, val)
    end
  end

  private

  def sync_workplace_and_employment_metadata
    parsed = {}
    raw = read_attribute(:competency_expectations)
    if raw.present?
      begin
        p = JSON.parse(raw)
        parsed = p if p.is_a?(Hash)
      rescue StandardError
        parsed["notes"] = raw
      end
    end

    parsed["employment_type"] = @virtual_employment_type if @virtual_employment_type.present?
    parsed["workplace_type"]  = @virtual_workplace_type  if @virtual_workplace_type.present?

    if parsed.any?
      self.competency_expectations = parsed.to_json
    end
  end

  def read_metadata(key)
    raw = read_attribute(:competency_expectations)
    return nil if raw.blank?

    begin
      parsed = JSON.parse(raw)
      parsed.is_a?(Hash) ? parsed[key] : nil
    rescue StandardError
      nil
    end
  end
end
