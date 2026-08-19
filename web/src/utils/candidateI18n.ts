export type Lang = "id" | "en";

export const candidateTranslations = {
  en: {
    stepper: {
      welcome: "Welcome",
      deviceCheck: "Device Check",
      live: "Interview",
      complete: "Complete",
    },
    welcome: {
      title: "AI Voice Interview",
      duration: "Time Limit",
      minutes: "minutes",
      language: "Language",
      skillsTested: "Competencies Assessed",
      level: "Target Level",
      tipsTitle: "Important Guidelines",
      tip1: "Find a quiet, distraction-free environment.",
      tip2: "The AI interviewer will ask follow-up questions dynamically based on your answers.",
      tip3: "Speak clearly at a natural pace using your microphone.",
      tip4: "You can mute your mic or end the interview whenever you are done.",
      consentTitle: "Voice Recording & AI Assessment Consent",
      consentBody:
        "I agree to have my voice recorded and analyzed by Rakamin AI Interview for recruitment and competency assessment purposes.",
      resumeNotice:
        "You have an active session in progress. Click continue to resume where you left off.",
      startBtn: "Proceed to Device Check",
      resumeBtn: "Resume Active Interview",
    },
    deviceCheck: {
      title: "Device & Audio Check",
      subtitle:
        "Let's make sure your microphone and speakers work smoothly before starting.",
      passedBanner: "Hardware checks passed successfully! You're all set.",
      readyBtn: "I'm Ready - Start Interview",
      backBtn: "Back to Guidelines",
    },
    live: {
      aiSpeaking: "AI Interviewer Speaking",
      listening: "Listening to you...",
      youSpeaking: "You are speaking",
      connecting: "Establishing secure connection...",
      reconnecting: "Briefly reconnecting...",
      reconnectedToast: "Reconnected. Please say 'check' or continue your answer.",
      connectionLost: "Connection lost. Please wait a moment...",
      wrappingUp: "Wrapping up interview...",
      timeRemaining: "Time remaining",
      timerCalm: "Normal",
      timerWarning: "5 minutes remaining — wrap up key points",
      timerCritical: "Less than 1 minute remaining!",
      toggleTranscriptShow: "Show Live Transcript",
      toggleTranscriptHide: "Hide Transcript",
      noTranscriptYet: "Transcript will appear here as the conversation unfolds.",
      micOn: "Mic Active",
      micMuted: "Muted",
      endBtn: "End Interview",
      endDialogTitle: "End the interview early?",
      endDialogBody:
        "Are you sure you want to finish now? Your responses will be finalized and submitted for evaluation.",
      endDialogConfirm: "Yes, End Interview",
      endDialogCancel: "Continue Interview",
    },
    complete: {
      title: "Interview Completed!",
      subtitle: "Thank you for completing the AI Voice Assessment.",
      recordedNotice:
        "Your voice responses and competency evidence have been securely recorded.",
      nextStepsTitle: "What happens next?",
      nextStep1: "Our AI evaluates competency anchors against the role rubric.",
      nextStep2:
        "The recruitment team will review your portfolio and fit/gap report.",
      nextStep3: "You will be contacted via email regarding next recruitment stages.",
      closeTabNotice: "You may safely close this browser window now.",
    },
  },
  id: {
    stepper: {
      welcome: "Sambutan",
      deviceCheck: "Cek Perangkat",
      live: "Interview",
      complete: "Selesai",
    },
    welcome: {
      title: "AI Voice Interview",
      duration: "Batas Waktu",
      minutes: "menit",
      language: "Bahasa",
      skillsTested: "Kompetensi yang Diuji",
      level: "Target Level",
      tipsTitle: "Panduan Penting",
      tip1: "Pastikan Anda berada di ruangan yang tenang dan bebas gangguan.",
      tip2: "AI interviewer akan memberikan pertanyaan lanjutan secara dinamis berdasarkan jawaban Anda.",
      tip3: "Bicaralah dengan jelas dan natural menggunakan mikrofon Anda.",
      tip4: "Anda dapat mematikan mikrofon (mute) atau mengakhiri interview jika sudah selesai.",
      consentTitle: "Persetujuan Perekaman Suara & Evaluasi AI",
      consentBody:
        "Saya menyetujui perekaman suara dan evaluasi kompetensi oleh Rakamin AI Interview untuk keperluan proses seleksi kerja.",
      resumeNotice:
        "Anda memiliki sesi interview yang sedang berjalan. Klik lanjutkan untuk melanjutkan sesi Anda.",
      startBtn: "Lanjut ke Cek Perangkat",
      resumeBtn: "Lanjutkan Sesi Interview",
    },
    deviceCheck: {
      title: "Pemeriksaan Perangkat & Audio",
      subtitle:
        "Pastikan mikrofon dan speaker Anda berfungsi optimal sebelum memulai interview.",
      passedBanner: "Semua pengujian perangkat berhasil! Anda siap memulai.",
      readyBtn: "Saya Siap - Mulai Interview",
      backBtn: "Kembali ke Panduan",
    },
    live: {
      aiSpeaking: "AI Interviewer Berbicara",
      listening: "Mendengarkan Anda...",
      youSpeaking: "Anda sedang berbicara",
      connecting: "Menghubungkan ke sesi audio...",
      reconnecting: "Menyambung ulang koneksi...",
      reconnectedToast: "Koneksi pulih. Ucapkan 'cek' atau lanjutkan jawaban Anda.",
      connectionLost: "Koneksi terputus. Mohon tunggu sejenak...",
      wrappingUp: "Menyelesaikan interview...",
      timeRemaining: "Sisa waktu",
      timerCalm: "Normal",
      timerWarning: "Sisa waktu 5 menit — simpulkan poin utama Anda",
      timerCritical: "Sisa waktu kurang dari 1 menit!",
      toggleTranscriptShow: "Tampilkan Teks Transkrip",
      toggleTranscriptHide: "Sembunyikan Transkrip",
      noTranscriptYet: "Transkrip percakapan akan muncul otomatis di sini.",
      micOn: "Mic Aktif",
      micMuted: "Mic Dimatikan",
      endBtn: "Akhiri Interview",
      endDialogTitle: "Akhiri interview sekarang?",
      endDialogBody:
        "Apakah Anda yakin ingin mengakhiri sesi interview ini? Seluruh rekaman jawaban Anda akan dikirim untuk penilaian.",
      endDialogConfirm: "Ya, Akhiri Interview",
      endDialogCancel: "Lanjutkan Interview",
    },
    complete: {
      title: "Interview Telah Selesai!",
      subtitle: "Terima kasih telah menyelesaikan sesi AI Voice Assessment.",
      recordedNotice:
        "Jawaban suara dan bukti kompetensi Anda telah tersimpan dengan aman.",
      nextStepsTitle: "Apa langkah selanjutnya?",
      nextStep1:
        "Sistem AI menyusun laporan portfolio kompetensi sesuai standar peran.",
      nextStep2:
        "Tim rekruter & penilai akan mereview hasil interview dan fit/gap report Anda.",
      nextStep3:
        "Informasi tahap seleksi berikutnya akan dikirimkan melalui email Anda.",
      closeTabNotice: "Anda dapat menutup tab / jendela browser ini sekarang.",
    },
  },
};
