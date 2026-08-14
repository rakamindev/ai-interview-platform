# frozen_string_literal: true

# Data-handling policy shown to candidates before an interview (UU PDP).
#
# Kept as a versioned constant rather than a DB table so it is trivially
# auditable and can evolve by bumping POLICY_VERSION without a schema change.
# Localization is provided by a plain mapping (en/id) driven by the
# assessment's configured language.
module ConsentPolicy
  POLICY_VERSION = '1.0'

  # Content per supported language. `language` must be one of Assessment::SUPPORTED_LANGUAGES.
  def self.content(language = 'en')
    lang = language.to_sym
    i18n.fetch(lang) { i18n[:en] }
  end

  def self.i18n
    {
      en: {
        data_collected: [
          'Your voice recording during the interview',
          'An automatically generated transcript of the conversation',
          'Your name (if provided by the interviewer) and the assessment results',
          'Technical metadata (browser, connection quality) needed to run the interview'
        ],
        purposes: [
          'To conduct and evaluate your skills assessment interview',
          'To generate your skill assessment report reviewed by the hiring team',
          'To maintain service quality and troubleshoot connection issues'
        ],
        retention: 'Your data is retained for as long as needed for the hiring process and legal obligations.',
        rights: [
          'Access a copy of your data',
          'Request correction of inaccurate data',
          'Request deletion of your data',
          'Withdraw your consent at any time'
        ],
        contact: 'Contact the company that invited you to this interview to exercise these rights.'
      },
      id: {
        data_collected: [
          'Rekaman suara Anda selama wawancara',
          'Transkrip percakapan yang dibuat otomatis',
          'Nama Anda (jika diisi pewawancara) dan hasil penilaian',
          'Metadata teknis (peramban, kualitas koneksi) untuk menjalankan wawancara'
        ],
        purposes: [
          'Untuk melaksanakan dan mengevaluasi wawancara penilaian keahlian Anda',
          'Untuk membuat laporan penilaian keahlian yang ditinjau tim rekrutmen',
          'Untuk menjaga kualitas layanan dan mengatasi masalah koneksi'
        ],
        retention: 'Data Anda disimpan selama diperlukan untuk proses rekrutmen dan kewajiban hukum.',
        rights: [
          'Mengakses salinan data Anda',
          'Meminta perbaikan data yang tidak akurat',
          'Meminta penghapusan data Anda',
          'Menarik persetujuan kapan saja'
        ],
        contact: 'Hubungi perusahaan yang mengundang Anda untuk wawancara ini untuk menggunakan hak-hak tersebut.'
      }
    }.freeze
  end
end
