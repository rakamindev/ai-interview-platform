# frozen_string_literal: true

require 'uri'

module Configuration
  # Parses and validates the public web origin used to build candidate links.
  # Keeping this separate from the API origin prevents Rails from generating
  # URLs for frontend-only routes on the API host.
  class WebBaseUrl
    class Invalid < ArgumentError; end

    class << self
      def parse!(value, production: false)
        raw_value = value.to_s.strip
        invalid!('is required') if raw_value.empty?

        uri = URI.parse(raw_value)
        validate!(uri, production:)
        normalize(uri)
      rescue URI::InvalidURIError
        invalid!('must be a valid absolute HTTP(S) origin')
      end

      private

      def validate!(uri, production:)
        validate_scheme!(uri)
        validate_host!(uri)
        validate_credentials!(uri)
        validate_path!(uri)
        validate_query!(uri)
        validate_fragment!(uri)
        validate_production_scheme!(uri) if production
      end

      def validate_scheme!(uri)
        invalid!('must use the http or https scheme') unless uri.is_a?(URI::HTTP)
      end

      def validate_host!(uri)
        invalid!('must include a host') if uri.host.to_s.empty?
      end

      def validate_credentials!(uri)
        invalid!('must not include credentials') if uri.userinfo
      end

      def validate_path!(uri)
        invalid!('must not include a path') unless ['', '/'].include?(uri.path.to_s)
      end

      def validate_query!(uri)
        invalid!('must not include a query') if uri.query
      end

      def validate_fragment!(uri)
        invalid!('must not include a fragment') if uri.fragment
      end

      def validate_production_scheme!(uri)
        invalid!('must use https in production') if uri.scheme != 'https'
      end

      def normalize(uri)
        normalized = uri.dup
        normalized.path = ''
        normalized.to_s.delete_suffix('/').freeze
      end

      def invalid!(reason)
        raise Invalid, "WEB_BASE_URL #{reason}"
      end
    end
  end
end
