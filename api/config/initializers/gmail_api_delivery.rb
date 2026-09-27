
# frozen_string_literal: true

require Rails.root.join("lib/gmail_api_delivery").to_s

ActionMailer::Base.add_delivery_method(
  :gmail_api,
  GmailApiDelivery
)
