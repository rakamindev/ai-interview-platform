# Initializers only load at boot — restart the server after editing this file.
# Partial match: :passw filters password, password_confirmation, etc.
Rails.application.config.filter_parameters += [
  :passw, :email, :secret, :token, :_key, :crypt, :salt, :certificate, :otp, :ssn, :cvv, :cvc, :api_key
]
