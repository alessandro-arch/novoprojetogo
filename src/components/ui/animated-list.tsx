import { motion } from "framer-motion";
import React from "react";

const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.05 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" } },
};

const reducedItemVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.2 } },
};

interface AnimatedListProps {
  children: React.ReactNode;
  className?: string;
  as?: keyof JSX.IntrinsicElements;
}

export const AnimatedList = ({ children, className, as = "div" }: AnimatedListProps) => {
  const MotionComp = motion[as as "div"] as typeof motion.div;
  return (
    <MotionComp
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className={className}
    >
      {children}
    </MotionComp>
  );
};

interface AnimatedItemProps {
  children: React.ReactNode;
  className?: string;
}

export const AnimatedItem = ({ children, className }: AnimatedItemProps) => {
  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  return (
    <motion.div
      variants={prefersReducedMotion ? reducedItemVariants : itemVariants}
      className={className}
    >
      {children}
    </motion.div>
  );
};
