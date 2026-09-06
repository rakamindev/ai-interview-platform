import { motion } from 'framer-motion';
import { AlertTriangle, RefreshCw, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ApiError } from '@/utils/apiError';

interface Props {
  error: ApiError;
  onRetry?: () => void;
  className?: string;
}

export default function ErrorState({ error, onRetry, className }: Props) {
  const isNetwork = error.status === undefined;
  const Icon = isNetwork ? WifiOff : AlertTriangle;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
      className={`flex flex-col items-center justify-center py-16 px-4 text-center ${className ?? ''}`}
    >
      <motion.div
        initial={{ scale: 0.8 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', duration: 0.4, bounce: 0.2 }}
        className="mb-4 rounded-full bg-destructive/10 p-4"
      >
        <Icon className="h-8 w-8 text-destructive" />
      </motion.div>

      <h3 className="mb-2 text-lg font-semibold">
        {isNetwork ? 'Koneksi Bermasalah' : 'Terjadi Kesalahan'}
      </h3>

      <p className="mb-6 max-w-sm text-sm text-muted-foreground leading-relaxed">
        {error.message}
      </p>

      {error.retryable && onRetry && (
        <Button variant="outline" onClick={onRetry} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Coba Lagi
        </Button>
      )}

      {error.status === 401 && (
        <Button
          className="mt-2"
          onClick={() => { window.location.href = '/login'; }}
        >
          Login Ulang
        </Button>
      )}
    </motion.div>
  );
}
