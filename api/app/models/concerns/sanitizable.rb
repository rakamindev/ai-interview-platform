module Sanitizable
  extend ActiveSupport::Concern

  class_methods do
    def sanitize_text_fields(*fields)
      before_validation do
        fields.each do |field|
          val = send(field)
          if val.is_a?(String)
            clean = ActionController::Base.helpers.strip_tags(val).strip
            send("#{field}=", clean)
          end
        end
      end
    end
  end
end
