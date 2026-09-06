# frozen_string_literal: true

module FactoryHelpers
  def create_org!(name:, scheme:)
    Organization.find_or_create_by!(scheme: scheme) do |o|
      o.name = name
      o.identifier = scheme
      o.host = "#{scheme}.test"
      o.alias_hosts = []
      o.config = {}
    end
  end
end
