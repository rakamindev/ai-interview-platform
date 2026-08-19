require "rails_helper"

RSpec.describe UserMailer, type: :mailer do
  describe "reset_password_instructions" do
    let(:user) { User.create!(email: 'test@example.com', password: 'password123', role: 'admin', reset_password_token: 'fake_token') }
    let(:mail) { UserMailer.reset_password_instructions(user) }

    it "renders the headers" do
      expect(mail.subject).to eq("Instruksi Reset Password - AI Interview")
      expect(mail.to).to eq(["test@example.com"])
    end

    it "renders the body" do
      expect(mail.body.encoded).to match("Ubah password saya")
    end
  end

end
