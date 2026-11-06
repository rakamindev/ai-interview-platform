# frozen_string_literal: true

require 'rails_helper'

# Production dan CI memakai eager_load = true. Tes ini memuat seluruh kode aplikasi
# seperti saat boot production, sehingga ketidakcocokan nama file/konstanta
# (Zeitwerk) ketahuan di tes lokal, bukan baru di server.
RSpec.describe 'Eager loading' do
  it 'loads every application file without Zeitwerk naming errors' do
    expect { Zeitwerk::Loader.eager_load_all }.not_to raise_error
  end
end
