class UserMailer < ApplicationMailer

  # Subject can be set in your I18n file at config/locales/en.yml
  # with the following lookup:
  #
  #   en.user_mailer.reset_password_instructions.subject
  #
  def reset_password_instructions(user)
    @user = user
    # Frontend URL hardcoded for local development
    @reset_url = "http://localhost:5173/reset-password?token=#{@user.reset_password_token}"
    
    mail to: @user.email, subject: "Instruksi Reset Password - AI Interview"
  end
end
