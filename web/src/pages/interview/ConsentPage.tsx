import { useState } from 'react';
import { motion, type Variants } from 'framer-motion';
import { Shield, Database, Clock, User, Mail, ChevronRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { grantConsent, type CandidateConsentInfo } from '@/services/candidateConsent';
import { parseApiError } from '@/utils/apiError';

interface Props {
  token: string;
  info: CandidateConsentInfo;
  onConsented: () => void;
}

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.07, delayChildren: 0.1 }
  }
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.23, 1, 0.32, 1] } }
};

export default function ConsentPage({ token, info, onConsented }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConsent() {
    setLoading(true);
    setError(null);
    try {
      await grantConsent(token);
      onConsented();
    } catch (err) {
      const parsed = parseApiError(err);
      setError(parsed.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="w-full max-w-xl"
      >
        {/* Header */}
        <motion.div variants={itemVariants} className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/10 mb-4">
            <Shield className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight mb-1">Persetujuan Data</h1>
          <p className="text-muted-foreground text-sm">
            <span className="font-medium">{info.organization_name}</span> menggunakan platform ini
            untuk proses rekrutmen <span className="font-medium">{info.assessment_name}</span>.
          </p>
        </motion.div>

        {/* Data yang dikumpulkan */}
        <motion.div variants={itemVariants} className="rounded-xl border bg-card p-5 mb-3 shadow-sm">
          <div className="flex items-center gap-2.5 mb-3">
            <Database className="h-4 w-4 text-muted-foreground shrink-0" />
            <h2 className="text-sm font-semibold">Data yang Dikumpulkan</h2>
          </div>
          <ul className="space-y-1.5">
            {info.data_collected.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                <ChevronRight className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground/50" />
                {item}
              </li>
            ))}
          </ul>
        </motion.div>

        {/* Retensi data */}
        <motion.div variants={itemVariants} className="rounded-xl border bg-card p-5 mb-3 shadow-sm">
          <div className="flex items-center gap-2.5 mb-2">
            <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
            <h2 className="text-sm font-semibold">Periode Penyimpanan Data</h2>
          </div>
          <p className="text-sm text-muted-foreground">{info.retention_period}</p>
        </motion.div>

        {/* Hak kandidat */}
        <motion.div variants={itemVariants} className="rounded-xl border bg-card p-5 mb-3 shadow-sm">
          <div className="flex items-center gap-2.5 mb-3">
            <User className="h-4 w-4 text-muted-foreground shrink-0" />
            <h2 className="text-sm font-semibold">Hak-Hak Kamu (UU PDP Indonesia)</h2>
          </div>
          <ul className="space-y-1.5">
            {info.candidate_rights.map((right, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                <ChevronRight className="h-3.5 w-3.5 mt-0.5 shrink-0 text-emerald-500" />
                {right}
              </li>
            ))}
          </ul>
        </motion.div>

        {/* Kontak */}
        <motion.div variants={itemVariants} className="flex items-center gap-2 text-xs text-muted-foreground mb-6 px-1">
          <Mail className="h-3.5 w-3.5 shrink-0" />
          <span>Pertanyaan terkait privasi? Hubungi <strong>{info.contact_email}</strong></span>
        </motion.div>

        {error && (
          <motion.p variants={itemVariants} className="text-sm text-destructive mb-3 text-center">
            {error}
          </motion.p>
        )}

        {/* CTA */}
        <motion.div variants={itemVariants}>
          <Button
            onClick={handleConsent}
            disabled={loading}
            className="w-full h-12 text-base font-medium"
          >
            {loading ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Menyimpan persetujuan...</>
            ) : (
              'Saya Mengerti dan Menyetujui — Mulai Interview'
            )}
          </Button>
          <p className="mt-3 text-center text-xs text-muted-foreground">
            Dengan mengklik tombol di atas, kamu menyetujui pengumpulan dan pemrosesan data
            sebagaimana dijelaskan di atas.
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
}
