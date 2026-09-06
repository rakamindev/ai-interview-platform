import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ConsentPage from '../ConsentPage';
import * as candidateConsentService from '@/services/candidateConsent';
import type { CandidateConsentInfo } from '@/services/candidateConsent';

vi.mock('@/services/candidateConsent', () => ({
  grantConsent: vi.fn(),
}));

const mockInfo: CandidateConsentInfo = {
  organization_name: 'PT Teknologi Hebat',
  assessment_name: 'Senior Frontend Engineer',
  consent_required: true,
  has_consent: false,
  disclosure_version: '1.0',
  data_collected: [
    'Rekaman audio sesi interview',
    'Transkrip percakapan berbasis teks',
    'Penilaian skill berbasis AI (tidak final)',
    'Waktu dan durasi sesi',
  ],
  retention_period: '1 tahun sejak tanggal interview',
  candidate_rights: [
    'Mengakses data yang telah dikumpulkan tentang Anda',
    'Meminta penghapusan data Anda dari sistem',
    'Menolak untuk melanjutkan interview kapan saja',
    'Mendapatkan salinan data Anda dalam format yang dapat dibaca',
  ],
  contact_email: 'privacy@rakamin.com',
};

describe('ConsentPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all disclosure sections under UU PDP', () => {
    render(<ConsentPage token="test-token" info={mockInfo} onConsented={vi.fn()} />);

    expect(screen.getByText('Persetujuan Data')).toBeInTheDocument();
    expect(screen.getByText('PT Teknologi Hebat')).toBeInTheDocument();
    expect(screen.getByText('Senior Frontend Engineer')).toBeInTheDocument();
    expect(screen.getByText('Data yang Dikumpulkan')).toBeInTheDocument();
    expect(screen.getByText('Rekaman audio sesi interview')).toBeInTheDocument();
    expect(screen.getByText('Periode Penyimpanan Data')).toBeInTheDocument();
    expect(screen.getByText('1 tahun sejak tanggal interview')).toBeInTheDocument();
    expect(screen.getByText('Hak-Hak Kamu (UU PDP Indonesia)')).toBeInTheDocument();
    expect(screen.getByText('Mengakses data yang telah dikumpulkan tentang Anda')).toBeInTheDocument();
    expect(screen.getByText(/privacy@rakamin.com/)).toBeInTheDocument();
    expect(
      screen.getByText('Saya Mengerti dan Menyetujui — Mulai Interview')
    ).toBeInTheDocument();
  });

  it('calls grantConsent and onConsented when CTA button is clicked', async () => {
    const onConsented = vi.fn();
    vi.mocked(candidateConsentService.grantConsent).mockResolvedValueOnce({
      status: 'granted',
      message: 'Persetujuan berhasil dicatat.',
    });

    render(<ConsentPage token="valid-token" info={mockInfo} onConsented={onConsented} />);

    const button = screen.getByText('Saya Mengerti dan Menyetujui — Mulai Interview');
    fireEvent.click(button);

    await waitFor(() => {
      expect(candidateConsentService.grantConsent).toHaveBeenCalledWith('valid-token');
      expect(onConsented).toHaveBeenCalled();
    });
  });

  it('displays error message when grantConsent fails', async () => {
    const onConsented = vi.fn();
    vi.mocked(candidateConsentService.grantConsent).mockRejectedValueOnce({
      response: {
        status: 500,
        data: { error: 'Gagal mencatat persetujuan ke database.' },
      },
    });

    render(<ConsentPage token="error-token" info={mockInfo} onConsented={onConsented} />);

    const button = screen.getByText('Saya Mengerti dan Menyetujui — Mulai Interview');
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText('Gagal mencatat persetujuan ke database.')).toBeInTheDocument();
      expect(onConsented).not.toHaveBeenCalled();
    });
  });
});
