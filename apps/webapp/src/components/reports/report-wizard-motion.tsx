'use client';

import { AnimatePresence, motion } from 'framer-motion';

const ease = [0.4, 0, 0.2, 1] as const;
const slidePx = 48;

type WizardStepPresenceProps = {
  panelKey: string;
  /** 1 = forward (slide in from right), -1 = back (slide in from left) */
  direction: number;
  children: React.ReactNode;
};

export function WizardStepPresence({
  panelKey,
  direction,
  children,
}: WizardStepPresenceProps) {
  return (
    <div className="relative overflow-x-hidden">
      <AnimatePresence mode="wait" initial={false} custom={direction}>
        <motion.div
          key={panelKey}
          custom={direction}
          variants={{
            enter: (dir: number) => ({
              x: dir > 0 ? slidePx : -slidePx,
              opacity: 0,
            }),
            center: {
              x: 0,
              opacity: 1,
            },
            exit: (dir: number) => ({
              x: dir > 0 ? -slidePx : slidePx,
              opacity: 0,
            }),
          }}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.35, ease }}
          className="space-y-4"
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
