# frozen_string_literal: true

# Parameter yang mengandung kata-kata ini ditulis sebagai [FILTERED] di log Rails
# (dan di ActiveRecord#inspect). Pencocokan bersifat sebagian: :token juga menyaring
# invite_token, :notes juga menyaring assessor_notes.
#
# Selain daftar bawaan Rails (kredensial), ikut disaring data pribadi kandidat dan
# penilaian asesor terhadap kandidat (F-18, UU PDP).
Rails.application.config.filter_parameters += %i[
  passw secret token _key crypt salt certificate otp ssn
  email candidate_name notes reason
]
