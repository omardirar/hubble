/**
 * Class Name Utility (cn)
 *
 * This module provides a utility function for combining and merging CSS class names
 * with Tailwind CSS support. It combines clsx for conditional class names and
 * tailwind-merge for intelligent Tailwind class merging.
 *
 * Features:
 * - Conditional class name support via clsx
 * - Tailwind CSS class merging via tailwind-merge
 * - Type-safe class name handling
 * - Prevents duplicate Tailwind classes
 */

import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Combine and merge CSS class names with Tailwind CSS support
 *
 * This function combines clsx for conditional class names and tailwind-merge
 * for intelligent Tailwind CSS class merging. It prevents duplicate classes
 * and ensures proper Tailwind CSS specificity.
 *
 * @param inputs - Variable number of class name inputs (strings, objects, arrays, etc.)
 * @returns Merged and deduplicated class name string
 *
 * @example
 * ```ts
 * cn("px-4 py-2", "bg-blue-500", { "text-white": isActive })
 * // Returns: "px-4 py-2 bg-blue-500 text-white" (if isActive is true)
 *
 * cn("px-4", "px-6") // Returns: "px-6" (px-4 is overridden by px-6)
 * ```
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
