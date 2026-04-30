"use client";

import { motion } from "framer-motion";
import { AlertCircle, Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SuccessViewProps {
  complaintId: string;
  severityScore?: number;
  fellowName?: string;
  onContinue?: () => void;
}

export function SuccessView({ complaintId, severityScore, fellowName, onContinue }: SuccessViewProps) {
  const isEmergency = (severityScore ?? 0) > 8;

  return (
    <div className="flex flex-col items-center justify-center p-6 md:p-12 w-full bg-slate-50 min-h-[400px] rounded-xl border border-slate-200">
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 max-w-lg w-full text-center relative overflow-hidden">
        {/* Animated Checkmark */}
        <div className="flex justify-center mb-6 relative">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 20, delay: 0.1 }}
            className="w-24 h-24 rounded-full bg-[#22C55E]/10 flex items-center justify-center"
          >
            <motion.svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#22C55E"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-12 h-12"
            >
              <motion.path
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.5, delay: 0.3, ease: "easeOut" }}
                d="M20 6L9 17l-5-5"
              />
            </motion.svg>
          </motion.div>
        </div>

        {/* Bilingual Headings */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.5 }}
        >
          <h2 className="text-2xl font-bold text-[#003366] mb-1">
            Complaint Submitted
          </h2>
          <h3 className="text-lg font-medium text-slate-600 mb-2 italic">
            Aduan Berjaya Dihantar
          </h3>
          <div className="bg-slate-100 px-4 py-2 rounded-lg inline-block mb-6">
            <span className="text-xs text-slate-500 uppercase tracking-wider font-semibold mr-2">Ticket ID:</span>
            <span className="text-sm font-mono font-bold text-[#003366]">{complaintId}</span>
          </div>
        </motion.div>

        {/* Emergency Notice */}
        {isEmergency && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            transition={{ duration: 0.4, delay: 0.7 }}
            className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-left flex gap-3 overflow-hidden"
          >
            <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-red-900 mb-1">
                EMERGENCY NOTICE / NOTIS KECEMASAN
              </p>
              <p className="text-xs text-red-700 leading-relaxed mb-2">
                This complaint has been flagged as high severity. Please contact the Fellow on duty immediately.
                <br />
                <span className="italic mt-1 block">Aduan ini diklasifikasikan sebagai kecemasan. Sila hubungi Felo bertugas dengan segera.</span>
              </p>
              {fellowName && (
                <p className="text-sm font-semibold text-red-800 bg-white px-2 py-1 rounded inline-block shadow-sm">
                  Fellow on Duty: {fellowName}
                </p>
              )}
            </div>
          </motion.div>
        )}

        {/* Instructions */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.8 }}
          className="text-sm text-slate-600 space-y-1 mb-8"
        >
          <p>You can track the status of your complaint in the dashboard.</p>
          <p className="italic">Anda boleh menyemak status aduan di papan pemuka.</p>
        </motion.div>

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.9 }}
          className="flex flex-col sm:flex-row gap-3 justify-center items-center"
        >
          <Button variant="outline" className="w-full sm:w-auto gap-2 border-slate-300 text-slate-700">
            <Printer className="w-4 h-4" />
            Print Receipt
          </Button>
          <Button variant="outline" className="w-full sm:w-auto gap-2 border-slate-300 text-slate-700">
            <Download className="w-4 h-4" />
            Download Summary
          </Button>
          {onContinue && (
            <Button onClick={onContinue} className="w-full sm:w-auto bg-[#003366] hover:bg-[#002244] text-white">
              Continue
            </Button>
          )}
        </motion.div>
      </div>
    </div>
  );
}
