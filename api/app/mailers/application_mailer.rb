# frozen_string_literal: true

class ApplicationMailer < ActionMailer::Base
  default from: -> { ENV.fetch('MAIL_FROM', 'no-reply@ai-interview-platform.local') }
  layout 'mailer'
end
