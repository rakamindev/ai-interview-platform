# frozen_string_literal: true

# Ensure RequestStore is cleared between requests
RequestStore::Middleware # force autoload
