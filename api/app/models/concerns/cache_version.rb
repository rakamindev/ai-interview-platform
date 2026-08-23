# frozen_string_literal: true

# Generation-token cache invalidation.
#
# Models that feed cached index endpoints include this concern to expose:
#   - Klass.cache_version       → stable token while data is unchanged
#   - Klass.bump_cache_version  → atomically orphans ALL cached entries
#
# Any create/update/destroy on the model bumps the version automatically
# (after_commit). Cached keys embed the version, so stale entries are never
# served — they simply expire unused. The delete-and-regenerate pattern is
# used instead of an integer counter because it needs no read-modify-write
# and works atomically across every Rails.cache store.
#
# Usage in a controller:
#   Rails.cache.fetch("assessments:v#{Assessment.cache_version}:t#{tenant}") { ... }
module CacheVersion
  extend ActiveSupport::Concern

  class_methods do
    def cache_version(expires_in: 10.minutes)
      Rails.cache.fetch(cache_version_key, expires_in: expires_in) do
        SecureRandom.uuid
      end
    end

    def bump_cache_version
      Rails.cache.delete(cache_version_key)
    end

    private

    def cache_version_key
      "#{name.underscore}:cache_version"
    end
  end

  included do
    after_commit { self.class.bump_cache_version }
  end
end
