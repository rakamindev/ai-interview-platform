import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

export default function PageLoader() {
  const location = useLocation();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(() => {
      setLoading(false);
    }, 400);
    return () => clearTimeout(timer);
  }, [location.pathname]);

  return (
    <AnimatePresence>
      {loading && (
        <motion.div
          key="top-page-loader-bar"
          initial={{ scaleX: 0, opacity: 1 }}
          animate={{ scaleX: 0.9, opacity: 1 }}
          exit={{ scaleX: 1, opacity: 0 }}
          transition={{ duration: 0.38, ease: "easeInOut" }}
          style={{ transformOrigin: "0% 50%" }}
          className="fixed top-0 left-0 right-0 h-[3.5px] bg-gradient-to-r from-primary via-[#fbc036] to-primary z-50 pointer-events-none shadow-sm shadow-[#fbc036]/40"
        />
      )}
    </AnimatePresence>
  );
}
