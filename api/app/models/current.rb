# frozen_string_literal: true

# Extracted verbatim from rakamin-api.
# Uses RequestStore for thread-safe, per-request globals.
module Current
  module Ext
    def class_accessor(name)
      Ext.module_eval do
        define_method("#{name}=") { |value| RequestStore.store[name] = value }

        define_method(name) do |&block|
          block ||= proc do
            raise "please set Current.#{name}, e.g. Current.#{name} = obj"
          end
          RequestStore.store.fetch(name, &block)
        end
      end
    end

    def using(**attributes)
      old_attributes = RequestStore.store.dup
      attributes.each { |k, v| public_send("#{k}=", v) }
      yield
    ensure
      RequestStore.store.replace(old_attributes)
    end

    def clear
      RequestStore.clear!
      Array(@after_clear).each(&:call)
    end

    def after_clear(&block)
      (@after_clear ||= []) << block
    end
  end

  extend Ext

  # Mirrors rakamin-api Current accessors
  class_accessor :user # OpenStruct with id, role (from JWT; no DB lookup)
  class_accessor :organization # Organization AR record (from public schema)
  class_accessor :tenant_id # Convenience alias: Current.organization.id
end
